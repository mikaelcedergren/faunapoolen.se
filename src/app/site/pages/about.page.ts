import { CxHeroComponent } from '@mikaelcedergren/cx-framework';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  CxStackComponent,
  CxGridComponent,
  CxCardComponent,
  CxButtonComponent,
} from '@mikaelcedergren/cx-framework';
import { ServiceAreaComponent } from '../sections/service-area.component';
import { SitePage } from '../site-page';
import { FAUNAPOOLEN_COMMERCIAL } from '../content/faunapoolen-commercial';
import { SiteShellComponent } from '../site-shell.component';
import { CustomerQuoteComponent } from '../sections/customer-quote.component';
import { CertificationComponent } from '../sections/certification.component';
@Component({
  selector: 'fp-about-page',
  imports: [
    ServiceAreaComponent,
    CxHeroComponent,
    CxStackComponent,
    CxGridComponent,
    CxCardComponent,
    CxButtonComponent,
    SiteShellComponent,
    CertificationComponent,
    CustomerQuoteComponent,
  ],
  templateUrl: './about.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutPage extends SitePage {
  protected readonly commercial = FAUNAPOOLEN_COMMERCIAL;
}
