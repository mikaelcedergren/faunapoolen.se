import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  CxAlertComponent,
  CxButtonComponent,
  CxToggleChipGroupComponent,
  CxInlineComponent,
  CxStackComponent,
  CxStateMessageComponent,
  CxTableComponent,
  CxTextFieldComponent,
  type CxTableColumn,
  type CxTableRow,
  type CxTableRowActivateEvent,
} from '@mikaelcedergren/cx-framework';
import type {
  CustomerRecord,
  EnquiryRecord,
  EnquiryStatus,
} from '../../../../server/src/enquiry-contracts';

@Component({
  selector: 'fp-enquiry-inbox',
  imports: [
    CxAlertComponent,
    CxButtonComponent,
    CxToggleChipGroupComponent,
    CxInlineComponent,
    CxStackComponent,
    CxStateMessageComponent,
    CxTableComponent,
    CxTextFieldComponent,
  ],
  templateUrl: './enquiry-inbox.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnquiryInboxComponent {
  readonly sessionExpired = output<void>();
  private readonly lifetime = new AbortController();
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly customers = signal<CustomerRecord[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly selectedId = signal(this.route.snapshot.queryParamMap.get('customer') ?? '');
  protected readonly filter = signal('all');
  protected readonly search = signal('');
  protected readonly reviewingEmail = signal('');
  protected readonly selected = computed(() =>
    this.customers().find((c) => c.id === this.selectedId()),
  );
  protected readonly filters = [
    { id: 'all', label: 'All' },
    { id: 'new', label: 'New enquiries' },
    { id: 'lead', label: 'Leads' },
    { id: 'customer', label: 'Customers' },
  ];
  protected readonly columns: CxTableColumn[] = [
    { id: 'name', label: 'Customer', key: true, size: 'flex', hideable: false, pinnable: false },
    { id: 'email', label: 'Email', size: 'flex', hideable: false, pinnable: false },
    { id: 'status', label: 'Status', size: 'content', hideable: false, pinnable: false },
    { id: 'enquiries', label: 'Enquiries', size: 'content', hideable: false, pinnable: false },
    { id: 'received', label: 'Latest enquiry', size: 'content', hideable: false, pinnable: false },
  ];
  protected readonly rows = computed<CxTableRow[]>(() =>
    this.customers()
      .filter(
        (c) =>
          this.filter() === 'all' ||
          (this.filter() === 'new'
            ? c.enquiries.some((e) => e.status === 'new')
            : c.status === this.filter()),
      )
      .filter((c) =>
        `${c.name} ${c.email}`.toLowerCase().includes(this.search().trim().toLowerCase()),
      )
      .sort((a, b) =>
        (b.enquiries[0]?.createdAt ?? b.createdAt).localeCompare(
          a.enquiries[0]?.createdAt ?? a.createdAt,
        ),
      )
      .map((c) => ({
        id: c.id,
        cells: {
          name: { kind: 'text', value: c.name || c.email, strong: true },
          email: { kind: 'text', value: c.email },
          status: {
            kind: 'text',
            value: c.enquiries.some((e) => e.status === 'new')
              ? 'New enquiry'
              : c.status === 'lead'
                ? 'Lead'
                : 'Customer',
          },
          enquiries: { kind: 'text', value: String(c.enquiries.length) },
          received: {
            kind: 'text',
            value: this.date(c.enquiries[0]?.createdAt ?? c.createdAt),
            muted: true,
          },
        },
      })),
  );
  constructor() {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed())
      .subscribe((params) => this.selectedId.set(params.get('customer') ?? ''));
    inject(DestroyRef).onDestroy(() => this.lifetime.abort());
    afterNextRender(() => void this.reload());
  }
  protected answeredFields(enquiry: EnquiryRecord) {
    return enquiry.fields.filter((field) => field.value);
  }
  protected date(value: string): string {
    return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(value),
    );
  }
  protected statusLabel(status: EnquiryStatus): string {
    return { new: 'New', contacted: 'Contacted', closed: 'Closed' }[status];
  }
  protected mailLabel(enquiry: EnquiryRecord): string {
    return {
      queued: 'Email queued',
      sending: 'Sending email',
      sent: enquiry.notification.messageId ? 'Accepted by Brevo' : 'Marked as sent',
      failed: 'Email not sent',
      uncertain: 'Email status unconfirmed',
      historical: 'Recorded before email notifications',
    }[enquiry.notification.state];
  }
  protected open(event: CxTableRowActivateEvent): void {
    this.select(String(event.rowId));
  }
  protected select(id: string): void {
    this.selectedId.set(id);
    this.error.set('');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { customer: id || null },
      queryParamsHandling: 'merge',
    });
  }
  private async request(url: string, init: RequestInit = {}): Promise<Response> {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(15000)]),
    });
    if (response.status === 401) {
      this.sessionExpired.emit();
      throw new Error('Your session expired. Sign in again.');
    }
    if (!response.ok)
      throw new Error(
        response.status === 409
          ? 'This record changed. Reload before trying again.'
          : 'The change could not be confirmed. Reload to check the saved record.',
      );
    return response;
  }
  private async load(): Promise<void> {
    const response = await this.request('/api/admin/customers');
    const data = (await response.json()) as { customers: CustomerRecord[] };
    this.customers.set(data.customers);
  }
  protected async reload(): Promise<void> {
    if (this.saving() || this.refreshing) return;
    this.refreshing = true;
    this.loading.set(true);
    this.error.set('');
    try {
      await this.load();
    } catch {
      if (!this.lifetime.signal.aborted)
        this.error.set('Customers could not be loaded. Try again.');
    } finally {
      this.loading.set(false);
      this.refreshing = false;
    }
  }
  private refreshing = false;
  private async mutate(url: string, method: string, body: unknown): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.request(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      await this.load();
    } catch (error) {
      if (!this.lifetime.signal.aborted)
        this.error.set(
          error instanceof Error
            ? error.message
            : 'The change could not be confirmed. Reload to check it.',
        );
    } finally {
      this.saving.set(false);
    }
  }
  protected update(enquiry: EnquiryRecord, status: EnquiryStatus): Promise<void> {
    return this.mutate('/api/admin/enquiries/' + enquiry.requestId, 'PATCH', {
      status,
      expectedRevision: enquiry.revision,
    });
  }
  protected changeCustomerStatus(customer: CustomerRecord): Promise<void> {
    return this.mutate('/api/admin/customers/' + customer.id, 'PATCH', {
      status: customer.status === 'lead' ? 'customer' : 'lead',
      expectedRevision: customer.revision,
    });
  }
  protected async resolveEmail(
    enquiry: EnquiryRecord,
    outcome: 'sent' | 'not-sent',
  ): Promise<void> {
    await this.mutate('/api/admin/enquiries/' + enquiry.requestId + '/resolve-email', 'POST', {
      expectedRevision: enquiry.notification.revision,
      outcome,
    });
    if (!this.error()) this.reviewingEmail.set('');
  }
  protected retryEmail(enquiry: EnquiryRecord): Promise<void> {
    return this.mutate('/api/admin/enquiries/' + enquiry.requestId + '/retry-email', 'POST', {
      expectedRevision: enquiry.notification.revision,
    });
  }
}
