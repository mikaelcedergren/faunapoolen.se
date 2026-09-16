import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CxHeroComponent, CxButtonComponent } from '@mikaelcedergren/cx-framework';
import { SitePage } from '../site-page';
import { FAUNAPOOLEN_COMMERCIAL } from '../content/faunapoolen-commercial';
import { SiteShellComponent } from '../site-shell.component';
import { CustomerQuoteComponent } from '../sections/customer-quote.component';
@Component({
  selector: 'fp-projects-page',
  imports: [CxHeroComponent, CxButtonComponent, SiteShellComponent, CustomerQuoteComponent],
  templateUrl: './projects.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsPage extends SitePage {
  protected readonly commercial = FAUNAPOOLEN_COMMERCIAL;
}
