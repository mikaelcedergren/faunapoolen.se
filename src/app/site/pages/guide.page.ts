import { ChangeDetectionStrategy, Component, inject, SecurityContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import {
  CxStackComponent,
  CxButtonComponent,
  CxTagComponent,
  CxDividerComponent,
  CxCardComponent,
} from '@mikaelcedergren/cx-framework';
import { SitePage } from '../site-page';
import { SiteShellComponent } from '../site-shell.component';
@Component({
  selector: 'fp-guide-page',
  imports: [
    CxStackComponent,
    CxButtonComponent,
    CxTagComponent,
    CxDividerComponent,
    CxCardComponent,
    SiteShellComponent,
  ],
  templateUrl: './guide.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuidePage extends SitePage {
  protected readonly guideReading = (() => {
    const sanitizer = inject(DomSanitizer);
    const article = this.document.createElement('div');
    article.innerHTML =
      sanitizer.sanitize(SecurityContext.HTML, this.routeSnapshot.data['bodyHtml'] as string) ?? '';
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
