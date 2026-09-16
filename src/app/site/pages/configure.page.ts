import { CxHeroComponent } from '@mikaelcedergren/cx-framework';
import type { CxDropdownOption } from '@mikaelcedergren/cx-framework';
import type { EnquiryInput } from '../../../../server/src/enquiry-contracts';
import type { FaunapoolenPackage } from '../content/faunapoolen-content';
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
  CxGridComponent,
  CxDropdownComponent,
  CxTextFieldComponent,
  CxTextAreaComponent,
  CxEmailFieldComponent,
  CxButtonComponent,
} from '@mikaelcedergren/cx-framework';
import { SitePage } from '../site-page';
import { SiteShellComponent } from '../site-shell.component';
import { Router } from '@angular/router';
import { SiteMeasurement } from '../site-measurement';
@Component({
  selector: 'fp-configure-page',
  imports: [
    CxHeroComponent,
    CxStackComponent,
    CxAlertComponent,
    CxGridComponent,
    CxDropdownComponent,
    CxTextFieldComponent,
    CxTextAreaComponent,
    CxEmailFieldComponent,
    CxButtonComponent,
    SiteShellComponent,
  ],
  templateUrl: './configure.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfigurePage extends SitePage {
  private readonly router = inject(Router);
  protected readonly measurement = inject(SiteMeasurement);
  protected readonly comparePackages = $localize`:@@enquiry.comparePackages:Compare pool packages and prices`;
  protected readonly ready = signal(false);
  private readonly injector = inject(Injector);
  protected readonly packageId = signal<FaunapoolenPackage['id'] | 'unsure'>('unsure');
  protected readonly serviceId = signal<FaunapoolenService>('unsure');
  protected readonly selectedPackage = computed(() =>
    this.packages.find((item) => item.id === this.packageId()),
  );
  protected readonly submitted = signal(false);
  protected readonly sending = signal(false);
  protected readonly deliveryError = signal('');
  protected readonly pendingRequest = signal<EnquiryInput | undefined>(undefined);
  protected readonly submitLabel = $localize`:@@enquiry.send:Send enquiry`;
  protected readonly receivedTitle = $localize`:@@enquiry.received:Your enquiry has been received`;
  protected readonly receivedBody = $localize`:@@enquiry.receivedBody:Thank you. We’ll contact you to discuss your garden and the next step.`;
  protected readonly privacyNotice = $localize`:@@enquiry.privacy:We use these details to respond to your enquiry and plan your project. This does not subscribe you to marketing emails.`;
  protected readonly unconfirmedMessage = $localize`:@@enquiry.unconfirmed:We couldn’t confirm receipt. Your details are still here. Send again to safely retry the same enquiry.`;
  protected readonly nameRequired = $localize`:@@enquiry.nameRequired:Enter your name.`;
  protected readonly locationRequired = $localize`:@@enquiry.locationRequired:Enter your town or postcode.`;
  protected readonly emailRequired = $localize`:@@enquiry.emailRequired:Enter your email address.`;
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
  protected readonly packageChoices: CxDropdownOption[] = [
    { id: 'unsure', label: this.editorial.unknown },
    ...this.packages.map((item) => ({
      id: item.id,
      label: item.name,
      description: `${item.area} · ${this.copy.common.from} ${this.money(item.price)} · ${this.copy.common.inclVat}`,
    })),
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
    const input: EnquiryInput = this.pendingRequest() ?? {
      requestId: crypto.randomUUID(),
      language: this.locale,
      name: this.contactName().trim(),
      email: this.contactEmail().trim(),
      phone: this.contactPhone().trim(),
      location: this.contactLocation().trim(),
      contactPeriod: '',
      notes: this.contactNotes().trim(),
      service: this.serviceId(),
      packageId: this.serviceId() === 'pool' ? this.packageId() : 'unsure',
      siteId: 'unsure',
      sizeId: 'included',
      featureIds: [],
      annualCare: false,
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
        packageId: input.packageId,
        service: input.service,
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
