import { GotlandPreviewComponent } from '../sections/gotland-preview.component';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  CxButtonComponent,
  CxGridComponent,
  CxHeroComponent,
  CxStackComponent,
  CxListComponent,
  CxListItemComponent,
} from '@mikaelcedergren/cx-framework';
import { NATURE_POOL_LANDING, POOL_ENQUIRY } from '../content/faunapoolen-landing';
import { FAUNAPOOLEN_COMMERCIAL } from '../content/faunapoolen-commercial';
import { PackageComparisonComponent } from '../sections/package-comparison.component';
import { ProcessComponent } from '../sections/process.component';
import { SitePage } from '../site-page';
import { SiteShellComponent } from '../site-shell.component';

@Component({
  selector: 'fp-pricing-page',
  imports: [
    GotlandPreviewComponent,
    CxButtonComponent,
    CxGridComponent,
    CxHeroComponent,
    CxStackComponent,
    CxListComponent,
    CxListItemComponent,
    PackageComparisonComponent,
    ProcessComponent,
    SiteShellComponent,
  ],
  templateUrl: './pricing.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PricingPage extends SitePage {
  protected readonly poolEnquiry = POOL_ENQUIRY;
  protected readonly commercial = FAUNAPOOLEN_COMMERCIAL;
  protected readonly questionsTitle = NATURE_POOL_LANDING.questionsTitle;
  protected readonly questions = [
    {
      id: 'scope',
      heading: this.commercial.scopeTitle,
      body: this.commercial.scopeBody,
      detail: this.commercial.scopeDetail,
    },
    {
      id: 'space',
      heading: this.commercial.footprintTitle,
      body: this.commercial.footprintBody,
      detail: '',
    },
    {
      id: 'care',
      heading: this.commercial.ownershipTitle,
      body: this.commercial.ownershipBody,
      detail: '',
    },
    {
      id: 'ready',
      heading: this.commercial.pricingQuestionTitle,
      body: this.commercial.pricingQuestionBody,
      detail: '',
    },
  ];
}
