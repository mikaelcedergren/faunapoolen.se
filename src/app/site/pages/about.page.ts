import { CxHeroComponent } from '@mikaelcedergren/cx-framework';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  CxStackComponent,
  CxGridComponent,
  CxCardComponent,
  CxButtonComponent,
} from '@mikaelcedergren/cx-framework';
import { SitePage } from '../site-page';
import { SiteShellComponent } from '../site-shell.component';
import { CustomerQuoteComponent } from '../sections/customer-quote.component';
import { CertificationComponent } from '../sections/certification.component';
@Component({
  selector: 'fp-about-page',
  imports: [
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
export class AboutPage extends SitePage {}
