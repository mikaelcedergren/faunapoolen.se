import { DOCUMENT } from '@angular/common';
import { Inject, Injectable, LOCALE_ID } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

export const SITE_ORIGIN = 'https://faunapoolen.se';
const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/assets/images/og-image.jpg`;

/** Per-page SEO, carried on each route's `data.seo`. `path` is always the Swedish (root) path. */
export interface PageSeo {
  /** Swedish canonical path, e.g. '/' or '/koi-pond-series.html'. */
  path: string;
  description: string;
  keywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  /** Absolute image URL; defaults to the site og-image. */
  ogImage?: string;
  /** og:type — 'website' (default) or 'article' for blog posts. */
  ogType?: string;
  /** Blog posts only: publish date (ISO 8601; date-only is fine). */
  datePublished?: string;
  /** Blog posts only: last content change; falls back to datePublished. */
  dateModified?: string;
  noindex?: boolean;
  /**
   * A login-gated page (the admin studio). Supersedes `noindex`: the page is sent as
   * `noindex, nofollow` and stripped of every other indexing signal. `noindex` alone keeps a page
   * out of results while still describing it to crawlers — this leaves nothing to describe.
   */
  private?: boolean;
  /** Extra JSON-LD @graph nodes (e.g. a BlogPosting) appended after Org/WebSite/WebPage. */
  graph?: object[];
}

// Every social tag this strategy emits, so a private page can be stripped of exactly what the
// public path sets. Keep these lists in step with `updateTitle` when a tag is added there.
const OG_PROPERTIES = [
  'og:type',
  'og:url',
  'og:site_name',
  'og:locale',
  'og:image',
  'og:title',
  'og:description',
  'og:image:width',
  'og:image:height',
  'article:published_time',
  'article:modified_time',
];
const TWITTER_NAMES = ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'];

/**
 * Sets title + per-route description, canonical, hreflang alternates (sv/en/x-default),
 * Open Graph, Twitter and JSON-LD @graph on every navigation. Runs during prerendering too,
 * so each static page (both locales) ships with its own metadata. Locale-aware via LOCALE_ID:
 * Swedish lives at the root, English under /en/.
 */
@Injectable()
export class SeoTitleStrategy extends TitleStrategy {
  constructor(
    private readonly titleService: Title,
    private readonly meta: Meta,
    @Inject(DOCUMENT) private readonly document: Document,
    @Inject(LOCALE_ID) private readonly localeId: string,
  ) {
    super();
  }

  private get isEnglish(): boolean {
    return this.localeId.toLowerCase().startsWith('en');
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    let route = snapshot.root;
    while (route.firstChild) route = route.firstChild;

    const seo = (route.data['seo'] as PageSeo | undefined) ?? { path: '/', description: '' };
    const title = this.buildTitle(snapshot) ?? 'Faunapoolen';
    const isEn = this.isEnglish;
    const lang = isEn ? 'en' : 'sv';
    const inLanguage = isEn ? 'en-US' : 'sv-SE';

    if (seo.private) {
      this.renderPrivatePage(title, lang);
      return;
    }

    const svPath = seo.path;
    const enPath = svPath === '/' ? '/en/' : `/en${svPath}`;
    const svUrl = SITE_ORIGIN + svPath;
    const enUrl = SITE_ORIGIN + enPath;
    const canonical = isEn ? enUrl : svUrl;
    const siteBase = isEn ? `${SITE_ORIGIN}/en/` : `${SITE_ORIGIN}/`;

    const ogImage = seo.ogImage ?? DEFAULT_OG_IMAGE;
    const ogTitle = seo.ogTitle ?? title;
    const ogDescription = seo.ogDescription ?? seo.description;

    this.document.documentElement.setAttribute('lang', lang);
    this.titleService.setTitle(title);
    this.meta.updateTag({ name: 'description', content: seo.description });
    if (seo.keywords) {
      this.meta.updateTag({ name: 'keywords', content: seo.keywords });
    }
    // The source pages carry no robots meta on indexable pages (indexable is the default), so only
    // emit one to mark a page noindex — keeps parity with the live <head>.
    if (seo.noindex) {
      this.meta.updateTag({ name: 'robots', content: 'noindex, follow' });
    } else {
      this.meta.removeTag("name='robots'");
    }

    this.meta.updateTag({ property: 'og:type', content: seo.ogType ?? 'website' });
    this.meta.updateTag({ property: 'og:url', content: canonical });
    this.meta.updateTag({ property: 'og:site_name', content: 'Faunapoolen' });
    this.meta.updateTag({ property: 'og:locale', content: isEn ? 'en_US' : 'sv_SE' });
    this.meta.updateTag({ property: 'og:image', content: ogImage });
    this.meta.updateTag({ property: 'og:title', content: ogTitle });
    this.meta.updateTag({ property: 'og:description', content: ogDescription });
    this.meta.updateTag({ property: 'og:image:width', content: '1200' });
    this.meta.updateTag({ property: 'og:image:height', content: '630' });
    if (seo.ogType === 'article' && seo.datePublished) {
      this.meta.updateTag({ property: 'article:published_time', content: seo.datePublished });
      this.meta.updateTag({
        property: 'article:modified_time',
        content: seo.dateModified ?? seo.datePublished,
      });
    } else {
      this.meta.removeTag("property='article:published_time'");
      this.meta.removeTag("property='article:modified_time'");
    }

    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: ogTitle });
    this.meta.updateTag({ name: 'twitter:description', content: ogDescription });
    this.meta.updateTag({ name: 'twitter:image', content: ogImage });

    this.setCanonical(canonical);
    this.setAlternates(svUrl, enUrl);
    this.setJsonLd(
      this.buildGraph(canonical, title, seo.description, inLanguage, ogImage, siteBase, seo),
    );
  }

  /**
   * A login-gated page describes itself to nobody: `noindex, nofollow` and not one other indexing
   * signal — no canonical, no hreflang pair linking the two locale copies, no social card, no
   * JSON-LD node joining it to the site graph. Tags are removed rather than merely skipped, so a
   * client-side navigation in from a public page cannot leave that page's metadata behind.
   */
  private renderPrivatePage(title: string, lang: string): void {
    this.document.documentElement.setAttribute('lang', lang);
    this.titleService.setTitle(title);
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    this.meta.removeTag("name='description'");
    this.meta.removeTag("name='keywords'");
    for (const property of OG_PROPERTIES) {
      this.meta.removeTag(`property='${property}'`);
    }
    for (const name of TWITTER_NAMES) {
      this.meta.removeTag(`name='${name}'`);
    }
    this.document.head.querySelector("link[rel='canonical']")?.remove();
    this.document.head
      .querySelectorAll("link[rel='alternate'][hreflang]")
      .forEach((link) => link.remove());
    this.setJsonLd(null);
  }

  private setCanonical(url: string): void {
    const head = this.document.head;
    let link = head.querySelector("link[rel='canonical']") as HTMLLinkElement | null;
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  private setAlternates(svUrl: string, enUrl: string): void {
    const head = this.document.head;
    head.querySelectorAll("link[rel='alternate'][hreflang]").forEach((el) => el.remove());
    const add = (hreflang: string, href: string): void => {
      const link = this.document.createElement('link');
      link.setAttribute('rel', 'alternate');
      link.setAttribute('hreflang', hreflang);
      link.setAttribute('href', href);
      head.appendChild(link);
    };
    add('sv', svUrl);
    add('en', enUrl);
    add('x-default', svUrl);
  }

  private buildGraph(
    canonical: string,
    title: string,
    description: string,
    inLanguage: string,
    image: string,
    siteBase: string,
    seo: PageSeo,
  ): object {
    const isArticle = seo.ogType === 'article';
    // Blog posts are typed BlogPosting with the Organization as author plus dates; every other
    // page keeps the plain WebPage node unchanged.
    const page: Record<string, unknown> = {
      '@type': isArticle ? 'BlogPosting' : 'WebPage',
      '@id': `${canonical}#webpage`,
      url: canonical,
      name: title,
      ...(isArticle ? { headline: title } : {}),
      description,
      inLanguage,
      isPartOf: { '@id': `${siteBase}#website` },
      ...(isArticle ? { author: { '@id': `${SITE_ORIGIN}/#organization` } } : {}),
      publisher: { '@id': `${SITE_ORIGIN}/#organization` },
      ...(isArticle
        ? {
            mainEntityOfPage: canonical,
            image,
            ...(seo.datePublished
              ? {
                  datePublished: seo.datePublished,
                  dateModified: seo.dateModified ?? seo.datePublished,
                }
              : {}),
          }
        : {}),
    };
    const graph: object[] = [
      {
        // Service-area business: designs and builds across Sweden with no public premises, so an
        // address is deliberately absent.
        '@type': ['Organization', 'LocalBusiness'],
        '@id': `${SITE_ORIGIN}/#organization`,
        name: 'Faunapoolen AB',
        url: `${SITE_ORIGIN}/`,
        logo: { '@type': 'ImageObject', url: `${SITE_ORIGIN}/assets/images/logo.png` },
        image,
        telephone: '+46735406757',
        areaServed: { '@type': 'Country', name: 'Sweden' },
      },
      {
        '@type': 'WebSite',
        '@id': `${siteBase}#website`,
        url: siteBase,
        name: 'Faunapoolen',
        inLanguage,
        publisher: { '@id': `${SITE_ORIGIN}/#organization` },
      },
      page,
      ...(seo.graph ?? []),
    ];
    return { '@context': 'https://schema.org', '@graph': graph };
  }

  private setJsonLd(data: object | null): void {
    const id = 'fp-jsonld';
    let script = this.document.getElementById(id) as HTMLScriptElement | null;
    if (!data) {
      script?.remove();
      return;
    }
    if (!script) {
      script = this.document.createElement('script');
      script.id = id;
      script.setAttribute('type', 'application/ld+json');
      this.document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(data);
  }
}
