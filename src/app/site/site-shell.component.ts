import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  OnInit,
  signal,
  viewChild,
  inject,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  CxMastheadComponent,
  CxLanguageSelectorComponent,
  CxStackComponent,
  CxInlineComponent,
  CxButtonComponent,
  CxGridComponent,
  CxAlertComponent,
  CX_THEMES,
} from '@mikaelcedergren/cx-framework';
import { SitePage } from './site-page';
import { LANGUAGE_NAMES, preferredLanguage } from './language';
import { SiteMeasurement } from './site-measurement';
import { CookieNoticeComponent } from './cookie-notice.component';

@Component({
  selector: 'fp-site-shell',
  imports: [
    CxMastheadComponent,
    CxLanguageSelectorComponent,
    CxStackComponent,
    CxInlineComponent,
    CxButtonComponent,
    CxGridComponent,
    CxAlertComponent,
    CookieNoticeComponent,
  ],
  templateUrl: './site-shell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteShellComponent extends SitePage implements OnInit {
  private readonly router = inject(Router);
  protected readonly measurement = inject(SiteMeasurement);
  private readonly cookieNotice = viewChild(CookieNoticeComponent);

  openCookieSettings(event: Event): void {
    this.cookieNotice()?.openSettings(event);
  }
  private readonly navigationContext = signal('');

  protected languageHref(href: string): string {
    return href + this.navigationContext();
  }

  private refreshNavigationContext(): void {
    const browser = this.document.defaultView;
    if (!browser) return;
    const query = new URLSearchParams(browser.location.search);
    const kept = new URLSearchParams();
    if (this.page === 'configure') {
      const service = query.get('service');
      const selected = query.get('package');
      if (service && ['pool', 'pond', 'stream', 'unsure'].includes(service))
        kept.set('service', service);
      if (selected && ['glade', 'summer', 'horizon'].includes(selected))
        kept.set('package', selected);
    }
    this.navigationContext.set((kept.size ? '?' + kept.toString() : '') + browser.location.hash);
    const suggestion = this.suggestion();
    if (suggestion)
      this.suggestion.set({
        ...suggestion,
        href: suggestion.href.split(/[?#]/)[0] + this.navigationContext(),
      });
  }
  protected readonly languageOptions = this.languages.map((language) => ({
    id: language.locale,
    label: language.label,
    flag: { en: '🇬🇧', sv: '🇸🇪', da: '🇩🇰' }[language.locale],
  }));

  protected changeLanguage(id: string): void {
    const language = this.languages.find((item) => item.locale === id);
    const browser = this.document.defaultView;
    if (language && browser && id !== this.locale) {
      this.rememberLanguage(id);
      this.refreshNavigationContext();
      browser.location.assign(this.languageHref(language.href));
    }
  }

  protected rememberLanguage(id: string): void {
    try {
      this.document.defaultView?.sessionStorage.setItem('fp-language-choice', id);
    } catch {
      /* Language navigation also works without storage. */
    }
  }

  protected readonly pricesLabel = $localize`:@@site.invitation.prices:See prices`;
  protected readonly priceInvitation = $localize`:@@site.invitation.body:Explore our nature pool packages, prices and what’s included.`;
  protected readonly languageLabel = $localize`:@@site.language.label:Language`;
  protected readonly suggestionHeading = $localize`:@@site.language.suggestion:Read this page in your preferred language`;
  protected readonly suggestion = signal<{ text: string; href: string } | undefined>(undefined);
  private suggestionKey = '';

  constructor() {
    super();
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationEnd) this.refreshNavigationContext();
    });
    afterNextRender(() => {
      this.refreshNavigationContext();
      this.measurement.initialize();
      this.measurement.track('page_view');
      const browser = this.document.defaultView;
      if (!browser) return;
      try {
        if (browser.sessionStorage.getItem('fp-language-choice')) return;
      } catch {
        /* Storage is optional. */
      }
      const preferred = preferredLanguage(browser.navigator.languages);
      if (preferred === this.locale) return;
      this.suggestionKey = `fp-language-dismissed:${this.locale}:${preferred}`;
      try {
        if (browser.sessionStorage.getItem(this.suggestionKey)) return;
      } catch {
        /* Storage is optional. */
      }
      this.suggestion.set({
        text: LANGUAGE_NAMES[preferred],
        href: this.languageHref(this.routeFor(this.page, preferred, this.guideId)),
      });
    });
  }

  protected dismissSuggestion(): void {
    this.suggestion.set(undefined);
    try {
      this.document.defaultView?.sessionStorage.setItem(this.suggestionKey, '1');
    } catch {
      /* Private browsing can disable storage. */
    }
  }

  ngOnInit(): void {
    for (const theme of CX_THEMES)
      this.document.documentElement.classList.remove(`theme-${theme.id}`);
    this.document.documentElement.classList.add('theme-aqua');
  }
}
