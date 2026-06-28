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
  noindex?: boolean;
  /** Extra JSON-LD @graph nodes (e.g. a BlogPosting) appended after Org/WebSite/WebPage. */
  graph?: object[];
}

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

    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: ogTitle });
    this.meta.updateTag({ name: 'twitter:description', content: ogDescription });
    this.meta.updateTag({ name: 'twitter:image', content: ogImage });

    this.setCanonical(canonical);
    this.setAlternates(svUrl, enUrl);
    this.setJsonLd(
      this.buildGraph(
        canonical,
        title,
        seo.description,
        inLanguage,
        ogImage,
        siteBase,
        seo.graph ?? [],
      ),
    );
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
    extra: object[],
  ): object {
    const graph: object[] = [
      {
        '@type': 'Organization',
        '@id': `${SITE_ORIGIN}/#organization`,
        name: 'Faunapoolen AB',
        url: `${SITE_ORIGIN}/`,
        logo: { '@type': 'ImageObject', url: `${SITE_ORIGIN}/assets/images/logo.png` },
        image,
        telephone: '+46735406757',
      },
      {
        '@type': 'WebSite',
        '@id': `${siteBase}#website`,
        url: siteBase,
        name: 'Faunapoolen',
        inLanguage,
        publisher: { '@id': `${SITE_ORIGIN}/#organization` },
      },
      {
        '@type': 'WebPage',
        '@id': `${canonical}#webpage`,
        url: canonical,
        name: title,
        description,
        inLanguage,
        isPartOf: { '@id': `${siteBase}#website` },
        publisher: { '@id': `${SITE_ORIGIN}/#organization` },
      },
      ...extra,
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
