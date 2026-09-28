import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  CxButtonComponent,
  CxGridComponent,
  CxHeroComponent,
  CxStackComponent,
  CxImageComponent,
  CxCardComponent,
  CxDividerComponent,
} from '@mikaelcedergren/cx-framework';
import { FAUNAPOOLEN_COMMERCIAL } from '../content/faunapoolen-commercial';
import { PackageComparisonComponent } from '../sections/package-comparison.component';
import { ProcessComponent } from '../sections/process.component';
import { SitePage } from '../site-page';
import { SiteShellComponent } from '../site-shell.component';

@Component({
  selector: 'fp-pricing-page',
  imports: [
    CxButtonComponent,
    CxGridComponent,
    CxHeroComponent,
    CxStackComponent,
    PackageComparisonComponent,
    ProcessComponent,
    SiteShellComponent,
    CxImageComponent,
    CxCardComponent,
    CxDividerComponent,
  ],
  templateUrl: './pricing.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PricingPage extends SitePage {
  protected readonly commercial = FAUNAPOOLEN_COMMERCIAL;
}
