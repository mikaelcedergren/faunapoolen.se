import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  CxButtonComponent,
  CxGridComponent,
  CxHeroComponent,
  CxInlineComponent,
  CxStackComponent,
} from '@mikaelcedergren/cx-framework';
import { FAUNAPOOLEN_IMAGES } from '../content/faunapoolen-brand';
import { FAUNAPOOLEN_COPY } from '../content/faunapoolen-content';
import { FAUNAPOOLEN_EDITORIAL } from '../content/faunapoolen-editorial';
import { CertificationStoryComponent } from '../sections/certification-story.component';
import { CertificationStripComponent } from '../sections/certification-strip.component';
import { GotlandPreviewComponent } from '../sections/gotland-preview.component';
import { NaturePoolBenefitsComponent } from '../sections/nature-pool-benefits.component';
import { PackageComparisonComponent } from '../sections/package-comparison.component';
import { PoolCostComparisonComponent } from '../sections/pool-cost-comparison.component';
import { ProcessComponent } from '../sections/process.component';
import { SitePage } from '../site-page';
import { SiteShellComponent } from '../site-shell.component';
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
export class HomePage extends SitePage {
  protected readonly images = FAUNAPOOLEN_IMAGES;
  protected readonly editorial = FAUNAPOOLEN_EDITORIAL;
  protected readonly copy = FAUNAPOOLEN_COPY;
}
