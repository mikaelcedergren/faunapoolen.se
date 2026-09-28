import {
  CxHeroComponent,
  CxImageComponent,
  CxDividerComponent,
  CxStackComponent,
  CxGridComponent,
  CxButtonComponent,
  CxCardComponent,
} from '@mikaelcedergren/cx-framework';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ServiceAreaComponent } from '../sections/service-area.component';
import { SitePage } from '../site-page';
import { SiteShellComponent } from '../site-shell.component';
import { CustomerQuoteComponent } from '../sections/customer-quote.component';
import { PackageComparisonComponent } from '../sections/package-comparison.component';
import { ProcessComponent } from '../sections/process.component';
@Component({
  selector: 'fp-home-page',
  imports: [
    ServiceAreaComponent,
    CxHeroComponent,
    CxStackComponent,
    CxGridComponent,
    CxButtonComponent,
    CxCardComponent,
    SiteShellComponent,
    CustomerQuoteComponent,
    PackageComparisonComponent,
    ProcessComponent,
    CxImageComponent,
    CxDividerComponent,
  ],
  templateUrl: './home.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage extends SitePage {}
