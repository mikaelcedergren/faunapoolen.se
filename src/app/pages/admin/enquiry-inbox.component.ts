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
import {
  CxAlertComponent,
  CxButtonComponent,
  CxFilterBarComponent,
  CxInlineComponent,
  CxStackComponent,
  CxStateMessageComponent,
  CxTableComponent,
  type CxTableColumn,
  type CxTableRow,
  type CxTableRowActivateEvent,
} from '@mikaelcedergren/cx-framework';
import type { EnquiryRecord, EnquiryStatus } from '../../../../server/src/enquiry-contracts';

@Component({
  selector: 'fp-enquiry-inbox',
  imports: [
    CxAlertComponent,
    CxButtonComponent,
    CxFilterBarComponent,
    CxInlineComponent,
    CxStackComponent,
    CxStateMessageComponent,
    CxTableComponent,
  ],
  templateUrl: './enquiry-inbox.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnquiryInboxComponent {
  protected choiceLabel(value: string): string {
    const labels: Record<string, string> = {
      pool: 'Nature pool',
      pond: 'Pond',
      stream: 'Stream or waterfall',
      unsure: 'Not sure yet',
      glade: 'The glade',
      summer: 'Summer days',
      horizon: 'The horizon',
      open: 'Open access',
      limited: 'Constrained access',
      complex: 'Rock or major level changes',
      included: 'Within the package range',
      larger: 'Larger',
      expansive: 'Extra large',
      deck: 'Deck',
      stone: 'Natural stone',
      lighting: 'Lighting',
      heating: 'Heating',
      morning: 'Weekdays 08:00–12:00',
      afternoon: 'Weekdays 12:00–17:00',
      evening: 'Weekdays 17:00–20:00',
    };
    return labels[value] ?? value;
  }
  protected additions(values: readonly string[]): string {
    return values.map((value) => this.choiceLabel(value)).join(', ') || 'None selected';
  }
  readonly sessionExpired = output<void>();
  private readonly lifetime = new AbortController();
  protected readonly enquiries = signal<EnquiryRecord[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly selectedId = signal('');
  protected readonly filter = signal('all');
  protected readonly selected = computed(() =>
    this.enquiries().find((e) => e.requestId === this.selectedId()),
  );
  protected readonly filters = [
    { id: 'all', label: 'All' },
    { id: 'new', label: 'New' },
    { id: 'contacted', label: 'Contacted' },
    { id: 'closed', label: 'Closed' },
  ];
  protected readonly columns: CxTableColumn[] = [
    { id: 'name', label: 'Enquiry', key: true, size: 'flex', hideable: false, pinnable: false },
    { id: 'location', label: 'Location', size: 'content', hideable: false, pinnable: false },
    { id: 'status', label: 'Status', size: 'content', hideable: false, pinnable: false },
    { id: 'received', label: 'Received', size: 'content', hideable: false, pinnable: false },
  ];
  protected readonly rows = computed<CxTableRow[]>(() =>
    this.enquiries()
      .filter((e) => this.filter() === 'all' || e.status === this.filter())
      .map((e) => ({
        id: e.requestId,
        cells: {
          name: { kind: 'text', value: e.name, strong: true },
          location: { kind: 'text', value: e.location },
          status: { kind: 'text', value: this.statusLabel(e.status) },
          received: { kind: 'text', value: this.date(e.createdAt), muted: true },
        },
      })),
  );
  constructor() {
    inject(DestroyRef).onDestroy(() => this.lifetime.abort());
    afterNextRender(() => void this.reload());
  }
  protected date(value: string): string {
    return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(value),
    );
  }
  protected statusLabel(status: EnquiryStatus): string {
    return { new: 'New', contacted: 'Contacted', closed: 'Closed' }[status];
  }
  protected open(event: CxTableRowActivateEvent): void {
    this.selectedId.set(String(event.rowId));
    this.error.set('');
  }
  protected async reload(): Promise<void> {
    if (this.saving() || this.refreshing) return;
    this.refreshing = true;
    this.loading.set(true);
    this.error.set('');
    try {
      const response = await fetch('/api/admin/enquiries', {
        signal: AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(15000)]),
      });
      if (response.status === 401) {
        this.sessionExpired.emit();
        return;
      }
      if (!response.ok) throw new Error('Enquiries could not be loaded. Try again.');
      const data = (await response.json()) as { enquiries: EnquiryRecord[] };
      this.enquiries.set(data.enquiries);
    } catch (error) {
      if (!this.lifetime.signal.aborted)
        this.error.set(
          error instanceof Error && error.message.startsWith('Enquiries')
            ? error.message
            : 'The inbox could not be reached. Try again.',
        );
    } finally {
      this.loading.set(false);
      this.refreshing = false;
    }
  }
  private refreshing = false;
  protected async update(status: EnquiryStatus): Promise<void> {
    const selected = this.selected();
    if (!selected || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const response = await fetch('/api/admin/enquiries/' + selected.requestId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, expectedRevision: selected.revision }),
        signal: AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(15000)]),
      });
      if (response.status === 401) {
        this.sessionExpired.emit();
        return;
      }
      if (!response.ok)
        throw new Error(
          response.status === 409
            ? 'This enquiry changed elsewhere. Reload before updating it.'
            : 'The status could not be confirmed. Reload to check the saved status.',
        );
      const data = (await response.json()) as { enquiry: EnquiryRecord };
      this.enquiries.update((items) =>
        items.map((e) => (e.requestId === data.enquiry.requestId ? data.enquiry : e)),
      );
    } catch (error) {
      if (!this.lifetime.signal.aborted)
        this.error.set(
          error instanceof Error
            ? error.message
            : 'The status could not be saved. Reload to check it.',
        );
    } finally {
      this.saving.set(false);
    }
  }
}
