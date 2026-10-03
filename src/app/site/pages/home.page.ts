import { PoolCostComparisonComponent } from '../sections/pool-cost-comparison.component';
import { GotlandPreviewComponent } from '../sections/gotland-preview.component';
import {
  CxStackComponent,
  CxGridComponent,
  CxButtonComponent,
  CxHeroComponent,
  CxInlineComponent,
} from '@mikaelcedergren/cx-framework';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SitePage } from '../site-page';
import { SiteShellComponent } from '../site-shell.component';
import { PackageComparisonComponent } from '../sections/package-comparison.component';
import { CertificationStripComponent } from '../sections/certification-strip.component';
import { CertificationStoryComponent } from '../sections/certification-story.component';
import { ProcessComponent } from '../sections/process.component';
import { NaturePoolBenefitsComponent } from '../sections/nature-pool-benefits.component';
@Component({
  selector: 'fp-home-page',
  imports: [
    PoolCostComparisonComponent,
    GotlandPreviewComponent,
    CxStackComponent,
    CxGridComponent,
    CxHeroComponent,
    CxInlineComponent,
    CxButtonComponent,
    SiteShellComponent,
    PackageComparisonComponent,
    ProcessComponent,
    CertificationStripComponent,
    CertificationStoryComponent,
    NaturePoolBenefitsComponent,
  ],
  templateUrl: './home.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage extends SitePage {}
