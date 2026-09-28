import { ChangeDetectionStrategy, Component, inject, SecurityContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import {
  CxStackComponent,
  CxGridComponent,
  CxButtonComponent,
  CxCardComponent,
  CxDividerComponent,
} from '@mikaelcedergren/cx-framework';
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
    CxDividerComponent,
  ],
  templateUrl: './guide.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuidePage extends SitePage {
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
    });
    const sections = Array.from(article.querySelectorAll('h2')).map((heading, index) => {
      const id = `guide-section-${index + 1}`;
      heading.id = id;
      heading.classList.add('fp-anchor');
      return { id, title: heading.textContent ?? '' };
    });
    // Only generated heading IDs/classes are added after sanitizing the article. Preserve
    // those safe anchors: Angular's ordinary innerHTML pass otherwise removes every ID.
    return { html: sanitizer.bypassSecurityTrustHtml(article.innerHTML), sections };
  })();
}
