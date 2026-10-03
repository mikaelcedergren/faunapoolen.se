# Customers and enquiry notifications

Website enquiries are stored before receipt is acknowledged. Customers have stable IDs and a
unique, trimmed, lowercase email identity. Names do not merge people. A later enquiry can fill
an empty customer name; it cannot overwrite an established one. Each enquiry retains its original
submitted identity, form version, field labels and values. Only email is required for persistence;
each public form owns its current validation. The current form still requires name and location.

`/admin/customers` (also under `/en` and `/da`) provides customer search, new-enquiry filtering,
lead/customer status and chronological enquiry history. The previous `/admin/enquiries` route
shows the same interface. Enquiry follow-up status belongs to each enquiry, independently of
customer status. Returning customers with new enquiries reappear in the new-enquiry view.

The append-only schema migration 15 groups existing enquiries by normalized email. It preserves
the original records and does **not** email historical enquiries. The existing limit of 1,000
enquiries remains; customer and notification collections are bounded too. At capacity, admission
fails visibly without evicting customer records. Larger-volume retention/export is a future task.

## Delivery

The web process saves the customer, enquiry and notification in one transaction. A listener-free
worker sends notifications independently of paid campaign generation. It claims only its own
execution scope. Notifications use Brevo's transactional API; no subscriber or marketing contacts
are created, and no email is sent to the visitor.

- Sender: `Faunapoolen <michael@wargr.com>`
- Recipient: `COMPANY_EMAIL`
- Reply-to: the visitor's email
- Contents: submitted details and a link to the customer history

Notifications include the visitor's name in the subject when supplied, a separate message block,
non-empty form details, and a **View customer** link. Both HTML and plain-text alternatives are
sent. Form versions and internal references remain in the saved admin record, not the email.
Submitted text is escaped before it enters HTML.

Brevo automatically adds `List-Unsubscribe` to transactional messages as well as campaigns.
The free plan cannot remove it; mail clients may therefore show a mailing-list/unsubscribe banner.
Brevo documents replacement with `List-Help` as Enterprise-only and subject to approval:
https://help.brevo.com/hc/en-us/articles/19100260472850-FAQs-About-list-unsubscribe-and-list-help-headers-in-emails
Do not add fake or empty list headers to try to suppress the provider's policy.

The recipient is captured on the first delivery attempt, so changing `COMPANY_EMAIL` affects
notifications that have not yet been attempted. An existing queued retry keeps its original
recipient. Brevo acceptance is shown as **Accepted by Brevo**, not confirmed inbox delivery.

The worker uses a persisted claim, a 20-second request timeout and a 60-second claim expiry.
Concurrent workers cannot claim the same notification. Explicit rate-limit refusals back off
(up to five attempts); other definitive rejections offer **Retry email** in the admin. Timeouts,
interrupted claims, server errors and ambiguous duplicate responses become **Email status
unconfirmed**. They are never automatically resent. After checking Brevo's log, the owner can
mark one as sent or explicitly queue it again. The enquiry UUID is also sent as Brevo's
idempotency key; safety does not depend on the provider's short-lived deduplication window.

## Configuration and activation

The worker owns these values in its existing private, mode-0600 `.env.worker` file:

```dotenv
BREVO_API_KEY=<private key>
COMPANY_EMAIL=wolfie@mikaelcedergren.com
ENQUIRY_EMAIL_ENABLED=1
```

The existing Mac owner preview also uses the three mail values from `.env.worker` when running
isolated development with campaign generation disabled. `ENQUIRY_EMAIL_ENABLED=1` is the explicit
opt-in. OpenAI and web credentials remain excluded, and the shared database remains untouched.
Automated tests (`NODE_ENV=test`) never read this private configuration.

The root `.env` is not a runtime input. The web process strips these values and does not load the
worker file. `ENQUIRY_EMAIL_ENABLED` defaults to `0`; with sending disabled, enquiries remain
saved and notifications remain queued. Enabling email does not enable OpenAI generation.
Keep `CAMPAIGN_GENERATION_ENABLED=0` unless separately authorized. Later change COMPANY_EMAIL to
`info@faunapoolen.se` and restart the worker through the registered service flow.

Source preparation does not authorize installing schema 15 into operational storage. Activation
requires the coordinated maintenance procedure in `AGENTS.md` and `../SERVER-STANDARD.md`:
identify and stop every writer, verify a backup, run the registered offline quiesce/migrate/verify
commands, select schema-compatible web and worker versions, then restart and verify readiness.
Never point an old runtime at the upgraded database or run migration from normal startup.

Automated verification uses synthetic temporary databases and injected email responses. A live
notification to the configured test inbox is a separate owner-directed check after activation.
