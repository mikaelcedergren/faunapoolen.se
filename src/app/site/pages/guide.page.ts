import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  SecurityContext,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import {
  CxButtonComponent,
  CxCardComponent,
  CxGridComponent,
  CxHeroComponent,
  CxSidebarLayoutComponent,
  CxStackComponent,
} from '@mikaelcedergren/cx-framework';
import { BLOG_ARTICLES } from '../content/blog-catalog';
import { FAUNAPOOLEN_EDITORIAL } from '../content/faunapoolen-editorial';
import { PROTECTED_RECOMMENDATIONS } from '../content/protected-guide-presentation';
import { SITE_UI } from '../content/site-ui';
import { SitePage } from '../site-page';
import { SiteShellComponent } from '../site-shell.component';
@Component({
  selector: 'fp-guide-page',
  imports: [
    CxStackComponent,
    CxGridComponent,
    CxButtonComponent,
    CxCardComponent,
    SiteShellComponent,
    CxHeroComponent,
    CxSidebarLayoutComponent,
  ],
  templateUrl: './guide.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuidePage extends SitePage {
  protected readonly editorial = FAUNAPOOLEN_EDITORIAL;
  protected readonly ui = SITE_UI;
  protected readonly guide =
    BLOG_ARTICLES.find((article) => article.id === this.guideId) ?? BLOG_ARTICLES[0];
  protected readonly relatedGuides = this.guide.related
    .map((id) => BLOG_ARTICLES.find((article) => article.id === id)!)
    .filter(Boolean)
    .map((article) => {
      if (this.guideId !== 'build' && this.guideId !== 'difference') return article;
      const retained =
        PROTECTED_RECOMMENDATIONS[article.id as keyof typeof PROTECTED_RECOMMENDATIONS];
      return retained
        ? {
            ...article,
            title: retained.title,
            seo: { ...article.seo, description: retained.description },
          }
        : article;
    });

  protected readonly showContents = signal(true);
  private readonly guideLayout = viewChild.required('guideLayout', {
    read: ElementRef<HTMLElement>,
  });
  private readonly destroy = inject(DestroyRef);

  constructor() {
    super();
    afterNextRender(() => {
      const layout = this.guideLayout().nativeElement;
      const desktopWidth = Number.parseFloat(
        getComputedStyle(layout).getPropertyValue('--breakpoint-mobile'),
      );
      // Match the framework's container breakpoint. Removing the projected navigation
      // lets its empty-sidebar behavior remove the divider and reserved space too.
      const observer = new ResizeObserver(([entry]) => {
        this.showContents.set(entry.contentRect.width >= desktopWidth);
      });
      observer.observe(layout);
      this.destroy.onDestroy(() => observer.disconnect());
    });
  }

  protected readonly updatedLabel = $localize`:@@site.guides.updated:Updated`;
  protected readonly updatedDate = this.guide.seo.dateModified
    ? new Intl.DateTimeFormat(this.locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
        new Date(this.guide.seo.dateModified),
      )
    : '';
  protected readonly guideReading = (() => {
    const sanitizer = inject(DomSanitizer);
    const article = this.document.createElement('div');
    article.innerHTML =
      sanitizer.sanitize(SecurityContext.HTML, this.routeSnapshot.data['bodyHtml'] as string) ?? '';
    article.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((heading) => {
      heading.classList.add('cx-font-regular');
      if (heading.tagName === 'H2') heading.classList.add('fp-heading');
      if (/^H[3-6]$/.test(heading.tagName)) heading.classList.add('fp-subheading');
    });
    const sections = Array.from(article.querySelectorAll('h2')).map((heading, index) => {
      const id = `guide-section-${index + 1}`;
      heading.id = id;
      heading.classList.add('cx-scroll-target');
      return { id, title: heading.textContent ?? '' };
    });
    // Only generated heading IDs/classes are added after sanitizing the article. Preserve
    // those safe anchors: Angular's ordinary innerHTML pass otherwise removes every ID.
    return { html: sanitizer.bypassSecurityTrustHtml(article.innerHTML), sections };
  })();
}
