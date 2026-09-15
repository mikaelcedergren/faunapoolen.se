import { DOCUMENT } from '@angular/common';
import { Directive, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import type { CxMastheadItem } from '@mikaelcedergren/cx-framework';
import {
  AQUASCAPE_IMAGES,
  FAUNAPOOLEN_IMAGES,
  FAUNAPOOLEN_LOGO,
} from './content/faunapoolen-brand';
import {
  FAUNAPOOLEN_CARE_PRICE,
  FAUNAPOOLEN_COPY,
  FAUNAPOOLEN_FEATURES,
  FAUNAPOOLEN_PACKAGES,
  FAUNAPOOLEN_PROCESS,
  FAUNAPOOLEN_SITE_OPTIONS,
  FAUNAPOOLEN_SIZE_OPTIONS,
  FAUNAPOOLEN_TEAM,
  type FaunapoolenGuideId,
  type FaunapoolenLocale,
  type FaunapoolenPage,
  type FaunapoolenPackage,
} from './content/faunapoolen-content';
import {
  AQUASCAPE_PROJECTS,
  AQUASCAPE_REFERENCES,
  FAUNAPOOLEN_EVIDENCE_COPY,
  FAUNAPOOLEN_TESTIMONIALS,
} from './content/faunapoolen-evidence';
import {
  FAUNAPOOLEN_EDITORIAL,
  FAUNAPOOLEN_SERVICES,
  type FaunapoolenService,
} from './content/faunapoolen-editorial';
import { GOTLAND_COPY, GOTLAND_MEDIA } from './content/faunapoolen-gotland';
import { BLOG_ARTICLES } from './content/blog-catalog';

import { sitePath } from './site-paths';
import { SITE_UI } from './content/site-ui';
import { activeLanguage, LANGUAGE_NAMES, SUPPORTED_LANGUAGES } from './language';

/** Shared, read-only page content. Forms and gallery state belong to their own pages. */
@Directive()
export abstract class SitePage {
  protected readonly document = inject(DOCUMENT);
  protected readonly routeSnapshot = inject(ActivatedRoute).snapshot;
  private readonly routeData = this.routeSnapshot.data;
  protected readonly locale = activeLanguage();
  protected readonly ui = SITE_UI;
  protected readonly page = (this.routeData['page'] as FaunapoolenPage | undefined) ?? 'home';
  protected readonly guideId = this.routeData['guide'] as FaunapoolenGuideId | undefined;
  protected readonly copy = FAUNAPOOLEN_COPY;
  protected readonly editorial = FAUNAPOOLEN_EDITORIAL;
  protected readonly services = FAUNAPOOLEN_SERVICES;
  protected readonly evidence = FAUNAPOOLEN_EVIDENCE_COPY;
  protected readonly testimonials = FAUNAPOOLEN_TESTIMONIALS;
  protected readonly aquascape = AQUASCAPE_REFERENCES;
  protected readonly networkProjects = AQUASCAPE_PROJECTS;
  protected readonly carePrice = FAUNAPOOLEN_CARE_PRICE;
  protected readonly logo = FAUNAPOOLEN_LOGO;
  protected readonly images = FAUNAPOOLEN_IMAGES;
  protected readonly aquascapeImages = AQUASCAPE_IMAGES;
  protected readonly packages = FAUNAPOOLEN_PACKAGES;
  protected readonly process = FAUNAPOOLEN_PROCESS;
  protected readonly team = FAUNAPOOLEN_TEAM;
  protected readonly features = FAUNAPOOLEN_FEATURES;
  protected readonly siteOptions = FAUNAPOOLEN_SITE_OPTIONS;
  protected readonly sizeOptions = FAUNAPOOLEN_SIZE_OPTIONS;
  protected readonly guides = BLOG_ARTICLES;
  protected readonly guide =
    BLOG_ARTICLES.find((article) => article.id === this.guideId) ?? BLOG_ARTICLES[0];
  protected readonly relatedGuides = this.guide.related
    .map((id) => BLOG_ARTICLES.find((article) => article.id === id)!)
    .filter(Boolean);
  protected readonly languages = SUPPORTED_LANGUAGES.map((locale) => ({
    locale,
    label: LANGUAGE_NAMES[locale],
    href: this.routeFor(this.page, locale, this.guideId),
  }));
  protected readonly homeHref = this.routeFor('home');
  protected readonly configureHref = this.routeFor('configure');

  protected readonly navItems: CxMastheadItem[] = [
    this.navItem('nature-pools', this.copy.nav.naturePools),
    this.navItem('projects', this.copy.nav.projects),
    this.navItem('waterscapes', this.copy.nav.waterscapes),
    this.navItem('guides', this.copy.nav.guides),
    this.navItem('about', this.copy.nav.about),
    this.navItem('configure', $localize`:@@site.ui.contact:Contact`),
  ];

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

  protected packagePrice(item: FaunapoolenPackage): string {
    return this.money(item.price);
  }

  protected money(value: number): string {
    return new Intl.NumberFormat(this.locale, {
      style: 'currency',
      currency: 'SEK',
      maximumFractionDigits: 0,
    }).format(value);
  }

  protected packageHref(id: FaunapoolenPackage['id']): string {
    return this.configureHref + '?package=' + id;
  }
  private navItem(
    page: Exclude<FaunapoolenPage, 'home' | 'guide' | 'gotland'>,
    label: string,
  ): CxMastheadItem {
    if (page === 'guides' && this.page === 'guide') {
      return { id: page, label, href: this.routeFor(page), active: true };
    }
    if (page === 'projects' && this.page === 'gotland') {
      return { id: page, label, href: this.routeFor(page), active: true };
    }
    return { id: page, label, href: this.routeFor(page), active: page === this.page };
  }
}
