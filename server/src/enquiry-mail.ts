import { randomUUID } from 'node:crypto';
import {
  withImmediateTransaction,
  type SyncSqliteDatabase,
} from '@mikaelcedergren/cx-framework/server/sqlite';
import type { EnquiryField } from './enquiry-contracts.js';
import { enquiryEmailContent } from './enquiry-email-content.js';

export interface EnquiryMailConfiguration {
  apiKey: string;
  recipient: string;
}
export function enquiryMailConfiguration(
  environment: Readonly<Record<string, string | undefined>>,
): EnquiryMailConfiguration | undefined {
  const enabled = environment['ENQUIRY_EMAIL_ENABLED'] ?? '0';
  if (!['0', '1'].includes(enabled)) throw new Error('ENQUIRY_EMAIL_ENABLED must be 0 or 1.');
  if (enabled === '0') return undefined;
  const apiKey = environment['BREVO_API_KEY'];
  const recipient = environment['COMPANY_EMAIL'];
  if (!apiKey || apiKey.trim() !== apiKey)
    throw new Error('BREVO_API_KEY is required for enquiry emails.');
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient) || recipient.length > 254)
    throw new Error('COMPANY_EMAIL must be a valid email address.');
  return { apiKey, recipient };
}

/** One bounded delivery lane, independent of paid campaign generation. */
export function createEnquiryMailWorker({
  database,
  configuration,
  executionScope,
  appOrigin,
  fetcher = fetch,
  now = Date.now,
  onError = () => undefined,
}: {
  database: SyncSqliteDatabase;
  configuration: EnquiryMailConfiguration;
  executionScope: string;
  appOrigin: string;
  fetcher?: typeof fetch;
  now?: () => number;
  onError?: () => void;
}) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active: Promise<void> | undefined;
  let stopped = true;
  const abort = new AbortController();
  async function deliver(): Promise<void> {
    const claim = withImmediateTransaction(database, () => {
      // A lost response must never become an automatic second email after a restart.
      database.run(
        "UPDATE enquiry_notifications SET state='uncertain',revision=revision+1,error_code='interrupted',updated_at=? WHERE execution_scope=? AND state='sending' AND lease_until<=?",
        [new Date(now()).toISOString(), executionScope, now()],
      );
      const row = database.get(
        `SELECT n.*,e.record_json,e.customer_id FROM enquiry_notifications n
        JOIN enquiries e ON e.id=n.enquiry_id
        WHERE n.execution_scope=? AND n.state='queued' AND n.available_at<=? AND n.attempts<5
        ORDER BY n.available_at,n.enquiry_id LIMIT 1`,
        [executionScope, now()],
      );
      if (!row) return undefined;
      const token = randomUUID(),
        recipient = String(row['recipient'] ?? configuration.recipient);
      database.run(
        "UPDATE enquiry_notifications SET state='sending',attempts=attempts+1,revision=revision+1,claim_token=?,lease_until=?,recipient=?,updated_at=? WHERE enquiry_id=?",
        [
          token,
          now() + 60_000,
          recipient,
          new Date(now()).toISOString(),
          String(row['enquiry_id']),
        ],
      );
      return {
        enquiryId: String(row['enquiry_id']),
        json: String(row['record_json']),
        customerId: String(row['customer_id']),
        attempts: Number(row['attempts']),
        token,
        recipient,
      };
    });
    if (!claim) return;
    const id = claim.enquiryId;
    const input = JSON.parse(claim.json) as {
      email: string;
      name: string;
      language: 'en' | 'sv' | 'da';
      formVersion: string;
      fields: EnquiryField[];
    };
    const content = enquiryEmailContent(
      input,
      `${appOrigin}/en/admin/customers/?customer=${encodeURIComponent(claim.customerId)}`,
    );
    let state = 'uncertain',
      code: string | null = 'connection',
      messageId: string | null = null;
    let available = now();
    try {
      const response = await fetcher('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(20_000)]),
        headers: {
          'api-key': configuration.apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { name: 'Faunapoolen', email: 'michael@wargr.com' },
          to: [{ email: claim.recipient }],
          replyTo: { email: input.email },
          ...content,
          headers: { idempotencyKey: id },
        }),
      });
      if (response.ok) {
        const result = (await response.json()) as { messageId?: unknown };
        if (typeof result.messageId === 'string' && result.messageId.length <= 500) {
          state = 'sent';
          messageId = result.messageId;
          code = null;
        } else code = 'unconfirmed_receipt';
      } else if (response.status === 429) {
        const attempts = claim.attempts + 1;
        state = attempts < 5 ? 'queued' : 'failed';
        code = 'rate_limit';
        // Brevo's free daily quota can be exhausted. Back off without losing the enquiry.
        const retry = Number(response.headers.get('retry-after'));
        available =
          now() +
          Math.max(
            60_000,
            Math.min(86_400_000, Number.isFinite(retry) && retry > 0 ? retry * 1000 : 3_600_000),
          );
      } else if (response.status >= 400 && response.status < 500 && response.status !== 408) {
        const rejection = (await response.json().catch(() => ({}))) as { code?: string };
        state = rejection.code === 'duplicate_parameter' ? 'uncertain' : 'failed';
        code =
          rejection.code === 'duplicate_parameter' ? 'duplicate_unconfirmed' : 'provider_rejected';
      } else code = 'provider_unconfirmed';
      await response.body?.cancel().catch(() => undefined);
    } catch {
      /* A timeout or network failure cannot prove the email was not accepted. */
    }
    database.run(
      `UPDATE enquiry_notifications SET state=?,revision=revision+1,message_id=?,error_code=?,
      available_at=?,lease_until=NULL,claim_token=NULL,updated_at=? WHERE enquiry_id=? AND claim_token=? AND state='sending'`,
      [state, messageId, code, available, new Date(now()).toISOString(), id, claim.token],
    );
  }
  function runOnce(): Promise<void> {
    if (active) return active;
    active = deliver().finally(() => {
      active = undefined;
    });
    return active;
  }
  function schedule(): void {
    if (stopped) return;
    timer = setTimeout(() => {
      void runOnce().catch(onError).finally(schedule);
    }, 2000);
    timer.unref();
  }
  return {
    runOnce,
    start() {
      if (!stopped) return;
      stopped = false;
      schedule();
    },
    async close() {
      stopped = true;
      clearTimeout(timer);
      abort.abort();
      await active;
    },
  };
}
