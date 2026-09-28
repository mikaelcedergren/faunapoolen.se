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
  private readonly browser: boolean;

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
}
