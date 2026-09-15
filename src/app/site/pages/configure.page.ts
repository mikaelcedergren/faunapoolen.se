import type { CxDropdownOption } from '@mikaelcedergren/cx-framework';
import type { EnquiryInput } from '../../../../server/src/enquiry-contracts';
import {
  FAUNAPOOLEN_CARE_PRICE,
  FAUNAPOOLEN_SITE_OPTIONS,
  FAUNAPOOLEN_SIZE_OPTIONS,
  type FaunapoolenPackage,
} from '../content/faunapoolen-content';
import type { FaunapoolenService } from '../content/faunapoolen-editorial';
import {
  ChangeDetectionStrategy,
  Component,
  signal,
  computed,
  inject,
  Injector,
  afterNextRender,
} from '@angular/core';
import {
  CxStackComponent,
  CxAlertComponent,
  CxSidebarLayoutComponent,
  CxDropdownComponent,
  CxTextFieldComponent,
  CxTextAreaComponent,
  CxDividerComponent,
  CxEmailFieldComponent,
  CxButtonComponent,
  CxSplitComponent,
  CxMetricComponent,
} from '@mikaelcedergren/cx-framework';
import { SitePage } from '../site-page';
import { SiteShellComponent } from '../site-shell.component';
@Component({
  selector: 'fp-configure-page',
  imports: [
    CxStackComponent,
    CxAlertComponent,
    CxSidebarLayoutComponent,
    CxDropdownComponent,
    CxTextFieldComponent,
    CxTextAreaComponent,
    CxDividerComponent,
    CxEmailFieldComponent,
    CxButtonComponent,
    CxSplitComponent,
    CxMetricComponent,
    SiteShellComponent,
  ],
  templateUrl: './configure.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfigurePage extends SitePage {
  protected readonly ready = signal(false);
  private readonly injector = inject(Injector);
  protected readonly packageId = signal<FaunapoolenPackage['id'] | 'unsure'>('unsure');
  protected readonly siteId = signal<(typeof FAUNAPOOLEN_SITE_OPTIONS)[number]['id'] | 'unsure'>(
    'unsure',
  );
  protected readonly sizeId = signal<(typeof FAUNAPOOLEN_SIZE_OPTIONS)[number]['id']>('included');
  protected readonly featureIds = signal<string[]>([]);
  protected readonly serviceId = signal<FaunapoolenService>('pool');
  protected readonly hasEstimate = computed(
    () => this.serviceId() === 'pool' && this.packageId() !== 'unsure',
  );
  protected readonly serviceLabel = computed(
    () => this.services.find((item) => item.id === this.serviceId())!.name,
  );
  protected readonly care = signal(false);
  protected readonly submitted = signal(false);
  protected readonly sending = signal(false);
  protected readonly deliveryError = signal('');
  protected readonly pendingRequest = signal<EnquiryInput | undefined>(undefined);
  protected readonly submitLabel = $localize`:@@enquiry.send:Send enquiry`;
  protected readonly receivedTitle = $localize`:@@enquiry.received:Your enquiry has been received`;
  protected readonly receivedBody = $localize`:@@enquiry.receivedBody:Your project details are saved with Faunapoolen. We’ll use your contact details to discuss the next step.`;
  protected readonly privacyNotice = $localize`:@@enquiry.privacy:We use these details to respond to your enquiry and plan your project. This does not subscribe you to marketing emails.`;
  protected readonly unconfirmedMessage = $localize`:@@enquiry.unconfirmed:We couldn’t confirm receipt. Your details are still here. Send again to safely retry the same enquiry.`;
  private readonly submitAttempted = signal(false);

  protected readonly contactName = signal('');
  protected readonly contactEmail = signal('');
  protected readonly contactPhone = signal('');
  protected readonly contactLocation = signal('');
  protected readonly contactPeriod = signal<string | undefined>(undefined);
  protected readonly contactNotes = signal('');

  protected readonly selectedPackage = computed(
    () => this.packages.find((item) => item.id === this.packageId()) ?? this.packages[1],
  );
  protected readonly selectedSite = computed(
    () => this.siteOptions.find((item) => item.id === this.siteId()) ?? this.siteOptions[0],
  );
  protected readonly selectedSize = computed(
    () => this.sizeOptions.find((item) => item.id === this.sizeId()) ?? this.sizeOptions[0],
  );
  protected readonly selectedFeatures = computed(() =>
    this.features.filter((item) => this.featureIds().includes(item.id)),
  );
  protected readonly projectEstimate = computed(
    () =>
      this.selectedPackage().price +
      this.selectedSite().price +
      this.selectedSize().price +
      this.selectedFeatures().reduce((total, item) => total + item.price, 0),
  );
  protected readonly yearlyEstimate = computed(() => (this.care() ? FAUNAPOOLEN_CARE_PRICE : 0));
  protected readonly contactPeriodOptions: CxDropdownOption[] = [
    {
      id: 'morning',
      label: $localize`:@@site.ui.weekdays_08_00_12_00:Weekdays 08:00–12:00`,
    },
    {
      id: 'afternoon',
      label: $localize`:@@site.ui.weekdays_12_00_17_00:Weekdays 12:00–17:00`,
    },
    {
      id: 'evening',
      label: $localize`:@@site.ui.weekdays_17_00_20_00:Weekdays 17:00–20:00`,
    },
  ];

  protected readonly serviceChoices: CxDropdownOption[] = this.services.map((item) => ({
    id: item.id,
    label: item.name,
  }));
  protected readonly packageChoices: CxDropdownOption[] = [
    { id: 'unsure', label: this.editorial.unknown },
    ...this.packages.map((item) => ({
      id: item.id,
      label: item.name,
      description: `${item.area} · ${this.copy.common.from} ${this.money(item.price)}`,
    })),
  ];
  protected readonly siteChoices: CxDropdownOption[] = [
    { id: 'unsure', label: this.editorial.unknown },
    ...this.siteOptions.map((item) => ({
      id: item.id,
      label: item.name,
      description: `${item.description}${item.price ? ' +' + this.money(item.price) : ''}`,
    })),
  ];
  protected readonly sizeChoices: CxDropdownOption[] = this.sizeOptions.map((item) => ({
    id: item.id,
    label: item.name,
    description: item.price ? '+' + this.money(item.price) : this.copy.configure.sizeBody,
  }));
  protected readonly featureChoices: CxDropdownOption[] = this.features.map((item) => ({
    id: item.id,
    label: item.name,
    description: '+' + this.money(item.price),
  }));
  protected readonly careChoices: CxDropdownOption[] = [
    { id: 'no', label: this.editorial.unknown },
    {
      id: 'yes',
      label: this.copy.configure.careYes,
      description: this.money(this.carePrice) + ' ' + this.copy.configure.yearly,
    },
  ];

  constructor() {
    super();
    afterNextRender(() => this.ready.set(true));
    const serviceParam = this.routeSnapshot.queryParamMap.get('service');
    const entryService = this.services.find((item) => item.id === serviceParam);
    if (entryService) this.serviceId.set(entryService.id);
    const packageParam = this.routeSnapshot.queryParamMap.get('package');
    const entryPackage = this.packages.find((item) => item.id === packageParam);
    if (entryPackage) {
      this.packageId.set(entryPackage.id);
      this.serviceId.set('pool');
    }
  }
  protected selectPackage(id: string | undefined): void {
    this.packageId.set(this.packages.find((item) => item.id === id)?.id ?? 'unsure');
  }
  protected selectService(id: string | undefined): void {
    this.serviceId.set(this.services.find((item) => item.id === id)?.id ?? 'unsure');
  }

  protected selectSite(id: string | undefined): void {
    this.siteId.set(this.siteOptions.find((item) => item.id === id)?.id ?? 'unsure');
  }

  protected selectSize(id: string | undefined): void {
    this.sizeId.set(this.sizeOptions.find((item) => item.id === id)?.id ?? 'included');
  }

  protected contactPeriodLabel(): string {
    return (
      this.contactPeriodOptions.find((option) => option.id === this.contactPeriod())?.label ??
      this.copy.configure.none
    );
  }

  protected fieldError(value: string): string | undefined {
    return this.submitAttempted() && !value.trim() ? this.copy.configure.requiredError : undefined;
  }

  protected emailError(): string | undefined {
    if (!this.submitAttempted()) {
      return undefined;
    }
    const value = this.contactEmail().trim();
    if (!value) {
      return this.copy.configure.requiredError;
    }
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? undefined : this.copy.configure.emailError;
  }

  protected async submitProject(): Promise<void> {
    if (this.sending() || this.submitted()) return;
    this.submitAttempted.set(true);
    if (!this.contactName().trim() || this.emailError() || !this.contactLocation().trim()) {
      afterNextRender(
        () => {
          this.document.querySelector<HTMLElement>('#configurator [aria-invalid="true"]')?.focus();
        },
        { injector: this.injector },
      );
      return;
    }
    const input: EnquiryInput = this.pendingRequest() ?? {
      requestId: crypto.randomUUID(),
      language: this.locale,
      name: this.contactName().trim(),
      email: this.contactEmail().trim(),
      phone: this.contactPhone().trim(),
      location: this.contactLocation().trim(),
      contactPeriod: (this.contactPeriod() ?? '') as EnquiryInput['contactPeriod'],
      notes: this.contactNotes().trim(),
      service: this.serviceId(),
      packageId: this.serviceId() === 'pool' ? this.packageId() : 'unsure',
      siteId: this.siteId(),
      sizeId: this.sizeId(),
      featureIds: this.serviceId() === 'pool' ? this.featureIds() : [],
      annualCare: this.serviceId() === 'pool' && this.care(),
    };
    this.pendingRequest.set(input);
    this.sending.set(true);
    this.deliveryError.set('');
    try {
      const response = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) {
        // A gateway/server failure can happen after persistence; retry the same reference.
        if (response.status < 500) this.pendingRequest.set(undefined);
        this.deliveryError.set(
          response.status === 429
            ? $localize`:@@enquiry.rateLimit:Please wait before sending another enquiry. Your details are still here.`
            : response.status === 400
              ? $localize`:@@enquiry.invalid:Check your details. Use no more than 120 characters for your name, 160 for your location and 4,000 for your message.`
              : $localize`:@@enquiry.unavailable:The enquiry inbox is unavailable right now. Your details are still here; please try again later.`,
        );
        return;
      }
      const receipt = (await response.json()) as { id?: string };
      if (receipt.id !== input.requestId) throw new Error('Invalid enquiry receipt');
      this.submitted.set(true);
      this.scrollToConfigurator();
    } catch {
      this.deliveryError.set(this.unconfirmedMessage);
    } finally {
      this.sending.set(false);
    }
  }

  private scrollToConfigurator(): void {
    queueMicrotask(() =>
      this.document.getElementById('configurator')?.scrollIntoView({ block: 'start' }),
    );
  }
}
