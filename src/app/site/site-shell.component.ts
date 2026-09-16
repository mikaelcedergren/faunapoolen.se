import { afterNextRender, ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import {
  CxMastheadComponent,
  CxLanguageSelectorComponent,
  CxStackComponent,
  CxInlineComponent,
  CxButtonComponent,
  CxGridComponent,
  CxDividerComponent,
  CxAlertComponent,
  CX_THEMES,
} from '@mikaelcedergren/cx-framework';
import { SitePage } from './site-page';
import { LANGUAGE_NAMES, preferredLanguage } from './language';

@Component({
  selector: 'fp-site-shell',
  imports: [
    CxMastheadComponent,
    CxLanguageSelectorComponent,
    CxStackComponent,
    CxInlineComponent,
    CxButtonComponent,
    CxGridComponent,
    CxDividerComponent,
    CxAlertComponent,
  ],
  templateUrl: './site-shell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteShellComponent extends SitePage implements OnInit {
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
      browser.location.assign(language.href + browser.location.search + browser.location.hash);
    }
  }

  protected rememberLanguage(id: string): void {
    try {
      this.document.defaultView?.sessionStorage.setItem('fp-language-choice', id);
    } catch {
      /* Language navigation also works without storage. */
    }
  }

  protected readonly faqLabel = $localize`:@@site.nav.faq:FAQ`;
  protected readonly contactLabel = $localize`:@@site.ui.contact:Contact`;
  protected readonly languageLabel = $localize`:@@site.language.label:Language`;
  protected readonly suggestionHeading = $localize`:@@site.language.suggestion:Read this page in your preferred language`;
  protected readonly suggestion = signal<{ text: string; href: string } | undefined>(undefined);
  private suggestionKey = '';

  constructor() {
    super();
    afterNextRender(() => {
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
        href: this.routeFor(this.page, preferred, this.guideId),
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
