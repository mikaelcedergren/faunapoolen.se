import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Inject,
  LOCALE_ID,
  PLATFORM_ID,
  ViewEncapsulation,
  inject,
  signal,
} from '@angular/core';

interface CampaignAttribution {
  landingPage: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  fbclid: string;
}

type SubmissionState = 'idle' | 'submitting' | 'success' | 'error';

interface CampaignWindow extends Window {
  gtag?: (...args: unknown[]) => void;
  fbq?: (...args: unknown[]) => void;
}

@Component({
  selector: 'fp-campaign-pond-packages',
  templateUrl: './pond-packages.html',
  styleUrl: './pond-packages.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PondPackagesCampaignComponent implements AfterViewInit {
  protected readonly en = inject(LOCALE_ID).toLowerCase().startsWith('en');
  protected readonly attribution: CampaignAttribution;
  protected readonly showMobileCta = signal(false);
  protected readonly submissionState = signal<SubmissionState>('idle');
  protected readonly submissionError = signal('');
  private readonly browser: boolean;
  private conversionTracked = false;

  constructor(
    @Inject(DOCUMENT) private readonly document: Document,
    @Inject(PLATFORM_ID) platformId: object,
    private readonly destroyRef: DestroyRef,
  ) {
    this.browser = isPlatformBrowser(platformId);

    if (!this.browser) {
      this.attribution = {
        landingPage: '',
        utmSource: '',
        utmMedium: '',
        utmCampaign: '',
        utmContent: '',
        fbclid: '',
      };
      return;
    }

    const params = new URLSearchParams(this.document.location.search);
    this.attribution = {
      landingPage: this.document.location.href,
      utmSource: params.get('utm_source') ?? '',
      utmMedium: params.get('utm_medium') ?? '',
      utmCampaign: params.get('utm_campaign') ?? '',
      utmContent: params.get('utm_content') ?? '',
      fbclid: params.get('fbclid') ?? '',
    };
  }

  ngAfterViewInit(): void {
    if (!this.browser) return;

    const heroCta = this.document.querySelector('.campaign-hero-actions .campaign-cta');
    const formSection = this.document.querySelector('#ansokan');
    const view = this.document.defaultView;
    if (!heroCta || !formSection || !view) return;

    let animationFrame = 0;
    const update = () => {
      animationFrame = 0;
      const heroCtaPassed = heroCta.getBoundingClientRect().bottom < 0;
      const formRect = formSection.getBoundingClientRect();
      const formVisible = formRect.top < view.innerHeight && formRect.bottom > 0;
      this.showMobileCta.set(heroCtaPassed && !formVisible);
    };
    const scheduleUpdate = () => {
      if (animationFrame) return;
      animationFrame = view.requestAnimationFrame(update);
    };

    update();
    view.addEventListener('scroll', scheduleUpdate, { passive: true });
    view.addEventListener('resize', scheduleUpdate);
    this.destroyRef.onDestroy(() => {
      view.removeEventListener('scroll', scheduleUpdate);
      view.removeEventListener('resize', scheduleUpdate);
      if (animationFrame) view.cancelAnimationFrame(animationFrame);
    });
  }

  protected async submitForm(event: SubmitEvent): Promise<void> {
    const form = event.currentTarget as HTMLFormElement | null;
    const view = this.document.defaultView as CampaignWindow | null;

    if (!form || !view || typeof view.fetch !== 'function') return;

    event.preventDefault();
    if (this.submissionState() === 'submitting' || !form.reportValidity()) return;

    this.submissionState.set('submitting');
    this.submissionError.set('');

    try {
      const response = await view.fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('rate-limit');
        }
        throw new Error('submission-failed');
      }

      form.reset();
      this.submissionState.set('success');
      this.trackLead(view);
      view.requestAnimationFrame(() => {
        this.document.querySelector<HTMLElement>('.campaign-form-success')?.focus();
      });
    } catch (error) {
      this.submissionError.set(
        error instanceof Error && error.message === 'rate-limit'
          ? this.en
            ? 'Too many attempts in a short time. Wait a moment and try again, or email info@faunapoolen.se.'
            : 'Det blev för många försök på kort tid. Vänta en stund och försök igen, eller mejla info@faunapoolen.se.'
          : this.en
            ? 'Your inquiry could not be sent right now. Try again or email info@faunapoolen.se.'
            : 'Det gick inte att skicka just nu. Försök igen eller mejla info@faunapoolen.se.',
      );
      this.submissionState.set('error');
    }
  }

  private trackLead(view: CampaignWindow): void {
    if (this.conversionTracked) return;

    this.conversionTracked = true;
    view.gtag?.('event', 'generate_lead', {
      lead_source: this.attribution.utmSource || 'pond_packages_campaign',
    });
    view.fbq?.('track', 'Lead', {
      content_name: 'Naturpool – kampanjsida',
    });
  }
}
