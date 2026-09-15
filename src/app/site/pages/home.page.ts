import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  CxStackComponent,
  CxGridComponent,
  CxInlineComponent,
  CxButtonComponent,
  CxDividerComponent,
  CxSplitComponent,
} from '@mikaelcedergren/cx-framework';
import { SitePage } from '../site-page';
import { SiteShellComponent } from '../site-shell.component';
import { CertificationComponent } from '../sections/certification.component';
import { CustomerQuoteComponent } from '../sections/customer-quote.component';
import { TechnologyComponent } from '../sections/technology.component';
import { PackageComparisonComponent } from '../sections/package-comparison.component';
import { ProcessComponent } from '../sections/process.component';
@Component({
  selector: 'fp-home-page',
  imports: [
    CxStackComponent,
    CxGridComponent,
    CxInlineComponent,
    CxButtonComponent,
    CxDividerComponent,
    CxSplitComponent,
    SiteShellComponent,
    CertificationComponent,
    CustomerQuoteComponent,
    TechnologyComponent,
    PackageComparisonComponent,
    ProcessComponent,
  ],
  templateUrl: './home.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage extends SitePage {}
