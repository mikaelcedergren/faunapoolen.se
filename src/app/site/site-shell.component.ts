import { afterNextRender, ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import {
  CxMastheadComponent,
  CxStackComponent,
  CxInlineComponent,
  CxButtonComponent,
  CxDividerComponent,
  CxGridComponent,
  CxSplitComponent,
  CxAlertComponent,
  CX_THEMES,
} from '@mikaelcedergren/cx-framework';
import { SitePage } from './site-page';
import { LANGUAGE_NAMES, preferredLanguage } from './language';

@Component({
  selector: 'fp-site-shell',
  imports: [
    CxMastheadComponent,
    CxStackComponent,
    CxInlineComponent,
    CxButtonComponent,
    CxDividerComponent,
    CxGridComponent,
    CxSplitComponent,
    CxAlertComponent,
  ],
  templateUrl: './site-shell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteShellComponent extends SitePage implements OnInit {
  protected readonly languageLabel = $localize`:@@site.language.label:Language`;
  protected readonly suggestionHeading = $localize`:@@site.language.suggestion:Read this page in your preferred language`;
  protected readonly suggestion = signal<{ text: string; href: string } | undefined>(undefined);
  private suggestionKey = '';

  constructor() {
    super();
    afterNextRender(() => {
      const browser = this.document.defaultView;
      if (!browser) return;
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
