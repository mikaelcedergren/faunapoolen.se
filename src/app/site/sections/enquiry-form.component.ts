import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  Input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import type { CxDropdownOption } from '@mikaelcedergren/cx-framework';
import {
  CxAlertComponent,
  CxButtonComponent,
  CxDropdownComponent,
  CxEmailFieldComponent,
  CxGridComponent,
  CxStackComponent,
  CxTextAreaComponent,
  CxTextFieldComponent,
} from '@mikaelcedergren/cx-framework';
import type { EnquirySubmission } from '../../../../server/src/enquiry-contracts';
import { PACKAGE_IDS } from '../../../../server/src/package-contracts';
import type { FaunapoolenPackage } from '../content/faunapoolen-content';
import { FAUNAPOOLEN_COPY } from '../content/faunapoolen-content';
import type { FaunapoolenService } from '../content/faunapoolen-editorial';
import { FAUNAPOOLEN_EDITORIAL, FAUNAPOOLEN_SERVICES } from '../content/faunapoolen-editorial';
import { POOL_ENQUIRY } from '../content/faunapoolen-landing';
import { PublicPackageCatalogue } from '../package-catalogue';
import { SiteMeasurement } from '../site-measurement';
import { SitePage } from '../site-page';
@Component({
  selector: 'fp-enquiry-form',
  imports: [
    CxStackComponent,
    CxAlertComponent,
    CxGridComponent,
    CxDropdownComponent,
    CxTextFieldComponent,
    CxTextAreaComponent,
    CxEmailFieldComponent,
    CxButtonComponent,
  ],
  templateUrl: './enquiry-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnquiryFormComponent extends SitePage {
  protected readonly packageCatalogue = inject(PublicPackageCatalogue);
  protected readonly packageIds = PACKAGE_IDS;
  protected readonly services = FAUNAPOOLEN_SERVICES;
  protected readonly editorial = FAUNAPOOLEN_EDITORIAL;
  protected readonly copy = FAUNAPOOLEN_COPY;

  @Input({ transform: booleanAttribute }) compact = false;
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly poolEnquiry = POOL_ENQUIRY;
  protected readonly poolJourney =
    this.page === 'nature-pools' ||
    this.page === 'pricing' ||
    this.routeSnapshot.queryParamMap.get('service') === 'pool' ||
    this.packageIds.some((id) => id === this.routeSnapshot.queryParamMap.get('package'));
  protected readonly measurement = inject(SiteMeasurement);
  protected readonly ready = signal(false);
  private readonly injector = inject(Injector);
  protected readonly packageId = signal<FaunapoolenPackage['id'] | 'unsure'>('unsure');
  protected readonly serviceId = signal<FaunapoolenService>('unsure');
  protected readonly submitted = signal(false);
  protected readonly sending = signal(false);
  protected readonly deliveryError = signal('');
  protected readonly pendingRequest = signal<EnquirySubmission | undefined>(undefined);
  protected readonly submitLabel = $localize`:@@enquiry.send:Send enquiry`;
  protected readonly receivedTitle = $localize`:@@enquiry.received:Your enquiry has been received`;
  protected readonly receivedBody = $localize`:@@enquiry.receivedBody:Thank you. We’ll contact you to discuss your garden and the next step.`;
  protected readonly privacyNotice = $localize`:@@enquiry.privacy:We use these details to respond to your enquiry and plan your project. This does not subscribe you to marketing emails.`;
  protected readonly unconfirmedMessage = $localize`:@@enquiry.unconfirmed:We couldn’t confirm receipt. Your details are still here. Send again to safely retry the same enquiry.`;
  protected readonly nameRequired = $localize`:@@enquiry.nameRequired:Enter your name.`;
  protected readonly locationRequired = $localize`:@@enquiry.locationRequired:Enter your town or postcode.`;
  protected readonly emailRequired = $localize`:@@enquiry.emailRequired:Enter your email address.`;
  protected readonly pricesLoading = $localize`:@@packages.loading:Loading packages`;
  protected readonly pricesUnavailable = $localize`:@@packages.unavailable:Packages could not be loaded. Try again or contact us about your pool.`;
  protected readonly retryPrices = $localize`:@@packages.retry:Try again`;
  private readonly submitAttempted = signal(false);

  protected readonly contactName = signal('');
  protected readonly contactEmail = signal('');
  protected readonly contactPhone = signal('');
  protected readonly contactLocation = signal('');
  protected readonly contactNotes = signal('');

  protected readonly serviceChoices: CxDropdownOption[] = this.services.map((item) => ({
    id: item.id,
    label: item.name,
  }));
  protected readonly packageChoices = computed<CxDropdownOption[]>(() => [
    { id: 'unsure', label: this.editorial.unknown },
    ...this.packageCatalogue.packages().map((item) => ({
      id: item.id,
      label: item.name,
      description: `${item.area} · ${this.copy.common.from} ${this.packageCatalogue.price(item)} · ${this.copy.common.priceExclusions}`,
    })),
  ]);
  constructor() {
    super();
    afterNextRender(() => this.ready.set(true));
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      if (this.pendingRequest() || this.submitted()) return;
      const entryPackage = this.packageIds.find((id) => id === params.get('package'));
      const entryService = this.services.find((item) => item.id === params.get('service'));
      this.packageId.set(entryPackage ?? 'unsure');
      this.serviceId.set(
        this.poolJourney || entryPackage ? 'pool' : (entryService?.id ?? 'unsure'),
      );
    });
  }

  protected selectPackage(id: string | undefined): void {
    this.packageId.set(
      this.packageCatalogue.packages().find((item) => item.id === id)?.id ?? 'unsure',
    );
    if (this.packageId() !== 'unsure') this.serviceId.set('pool');
    this.updateChoiceUrl();
  }
  protected selectService(id: string | undefined): void {
    this.serviceId.set(this.services.find((item) => item.id === id)?.id ?? 'unsure');
    if (this.serviceId() !== 'pool') this.packageId.set('unsure');
    this.updateChoiceUrl();
  }

  private updateChoiceUrl(): void {
    void this.router.navigate([], {
      queryParams: {
        package: this.packageId() === 'unsure' ? null : this.packageId(),
        service: this.serviceId() === 'unsure' ? null : this.serviceId(),
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
      preserveFragment: true,
    });
  }

  protected fieldError(value: string, message: string): string | undefined {
    return this.submitAttempted() && !value.trim() ? message : undefined;
  }

  protected emailError(): string | undefined {
    if (!this.submitAttempted()) {
      return undefined;
    }
    const value = this.contactEmail().trim();
    if (!value) {
      return this.emailRequired;
    }
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? undefined : this.copy.configure.emailError;
  }

  protected async submitProject(): Promise<void> {
    if (this.sending() || this.submitted()) return;
    if (this.packageId() !== 'unsure' && !this.packageCatalogue.value() && !this.pendingRequest())
      return;
    this.submitAttempted.set(true);
    if (!this.contactName().trim() || this.emailError() || !this.contactLocation().trim()) {
      this.measurement.track('enquiry_error', { error: 'validation' });
      afterNextRender(
        () => {
          this.document.querySelector<HTMLElement>('#configurator [aria-invalid="true"]')?.focus();
        },
        { injector: this.injector },
      );
      return;
    }
    const input: EnquirySubmission = this.pendingRequest() ?? {
      requestId: crypto.randomUUID(),
      language: this.locale,
      name: this.contactName().trim(),
      email: this.contactEmail().trim(),
      formVersion: this.compact ? 'consultation-compact-v2' : 'consultation-v2',
      fields: [
        {
          id: 'location',
          label: this.copy.configure.location,
          value: this.contactLocation().trim(),
        },
        { id: 'phone', label: this.copy.configure.phone, value: this.contactPhone().trim() },
        {
          id: 'service',
          label: this.editorial.service,
          value:
            this.serviceChoices.find((item) => item.id === this.serviceId())?.label ??
            this.editorial.unknown,
        },
        ...(this.serviceId() === 'pool'
          ? [
              {
                id: 'package',
                label: this.copy.configure.packageTitle,
                value:
                  this.packageChoices().find((item) => item.id === this.packageId())?.label ??
                  this.editorial.unknown,
              },
            ]
          : []),
        { id: 'notes', label: this.editorial.notes, value: this.contactNotes().trim() },
      ],
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
        this.measurement.track('enquiry_error', {
          error: response.status === 429 ? 'rate_limit' : 'unconfirmed',
        });
        // A gateway/server failure can happen after persistence; retry the same reference.
        if (response.status < 500) this.pendingRequest.set(undefined);
        this.deliveryError.set(
          response.status === 429
            ? $localize`:@@enquiry.rateLimit:Please wait before sending another enquiry. Your details are still here.`
            : response.status === 400
              ? $localize`:@@enquiry.invalid:Check your details. Use no more than 120 characters for your name, 160 for your location and 4,000 for your message.`
              : $localize`:@@enquiry.unavailable:We couldn’t confirm receipt. Your details are still here. Try again later, or email info@faunapoolen.se.`,
        );
        return;
      }
      const receipt = (await response.json()) as { id?: string };
      if (receipt.id !== input.requestId) throw new Error('Invalid enquiry receipt');
      this.submitted.set(true);
      this.measurement.track('generate_lead', {
        packageId: this.packageId(),
        service: this.serviceId(),
      });
      this.scrollToConfigurator();
    } catch {
      this.measurement.track('enquiry_error', { error: 'unconfirmed' });
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
