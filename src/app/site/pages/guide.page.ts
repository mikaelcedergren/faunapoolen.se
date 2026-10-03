import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
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
  CxGridComponent,
  CxHeroComponent,
  CxSidebarLayoutComponent,
  CxStackComponent,
} from '@mikaelcedergren/cx-framework';
import { BLOG_ARTICLES } from '../content/blog-catalog';
import { FAUNAPOOLEN_EDITORIAL } from '../content/faunapoolen-editorial';
import { SITE_UI } from '../content/site-ui';
import { GuideCardComponent } from '../sections/guide-card.component';
import { GuidePricesComponent, GUIDE_PRICE_HEADING } from '../sections/guide-prices.component';
import { PublicPackageCatalogue } from '../package-catalogue';
import { SitePage } from '../site-page';
import { SiteShellComponent } from '../site-shell.component';
@Component({
  selector: 'fp-guide-page',
  imports: [
    GuideCardComponent,
    GuidePricesComponent,
    CxStackComponent,
    CxGridComponent,
    CxButtonComponent,
    SiteShellComponent,
    CxHeroComponent,
    CxSidebarLayoutComponent,
  ],
  templateUrl: './guide.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuidePage extends SitePage {
  protected readonly isPriceGuide = this.guideId === 'naturpool-pris';
  protected readonly exploreTitle = $localize`:@@site.priceGuide.exploreTitle:Picture a nature pool in your garden`;
  protected readonly exploreBody = $localize`:@@site.priceGuide.exploreBody:Explore the shapes, swimming spaces and everyday life behind the budget.`;
  protected readonly exploreLink = $localize`:@@site.priceGuide.exploreLink:Explore our nature pools`;
  protected readonly editorial = FAUNAPOOLEN_EDITORIAL;
  protected readonly ui = SITE_UI;
  protected readonly guide =
    BLOG_ARTICLES.find((article) => article.id === this.guideId) ?? BLOG_ARTICLES[0];
  protected readonly relatedGuides = this.guide.related
    .map((id) => BLOG_ARTICLES.find((article) => article.id === id)!)
    .filter(Boolean);

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
  private readonly sanitizer = inject(DomSanitizer);
  private readonly packageCatalogue =
    this.guideId === 'naturpool-10-vanliga-fragor' ? inject(PublicPackageCatalogue) : undefined;
  protected readonly guideReading = computed(() => {
    const sanitizer = this.sanitizer;
    const article = this.document.createElement('div');
    article.innerHTML =
      sanitizer.sanitize(SecurityContext.HTML, this.routeSnapshot.data['bodyHtml'] as string) ?? '';
    const smallestPackage = this.packageCatalogue?.packages().find((item) => item.id === 'glade');
    if (smallestPackage && this.packageCatalogue) {
      const price = this.packageCatalogue.price(smallestPackage);
      const startingPrice = $localize`:@@site.guideQuestions.startingPrice:Our smallest nature pool package starts at ${price}:PRICE:, excluding VAT and shipping.`;
      article.querySelector('p')?.prepend(this.document.createTextNode(`${startingPrice} `));
    }
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
    if (this.isPriceGuide) sections.unshift({ id: 'guide-prices', title: GUIDE_PRICE_HEADING });
    // Only generated heading IDs/classes are added after sanitizing the article. Preserve
    // those safe anchors: Angular's ordinary innerHTML pass otherwise removes every ID.
    return { html: sanitizer.bypassSecurityTrustHtml(article.innerHTML), sections };
  });
}
