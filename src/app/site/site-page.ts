import { DOCUMENT } from '@angular/common';
import { Directive, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import type {
  FaunapoolenGuideId,
  FaunapoolenLocale,
  FaunapoolenPage,
} from './content/faunapoolen-content';
import { activeLanguage } from './language';
import { sitePath } from './site-paths';

/** Locale and route helpers. Each page or section owns the content it renders. */
@Directive()
export abstract class SitePage {
  protected readonly document = inject(DOCUMENT);
  protected readonly routeSnapshot = inject(ActivatedRoute).snapshot;
  protected readonly locale = activeLanguage();
  protected readonly page =
    (this.routeSnapshot.data['page'] as FaunapoolenPage | undefined) ?? 'home';
  protected readonly guideId = this.routeSnapshot.data['guide'] as FaunapoolenGuideId | undefined;
  protected readonly homeHref = this.routeFor('home');
  protected readonly configureHref = this.routeFor('configure');

  protected routeFor(
    page: FaunapoolenPage,
    locale: FaunapoolenLocale = this.locale,
    guideId?: FaunapoolenGuideId,
  ): string {
    return sitePath(page, locale, guideId);
  }
  protected guideHref(id: FaunapoolenGuideId): string {
    return this.routeFor('guide', this.locale, id);
  }
}
