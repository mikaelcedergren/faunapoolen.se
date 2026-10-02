import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  CxHeroComponent,
  CxStackComponent,
  CxButtonComponent,
  CxListComponent,
  CxListItemComponent,
} from '@mikaelcedergren/cx-framework';
import { GotlandPreviewComponent } from '../sections/gotland-preview.component';
import { NaturePoolBenefitsComponent } from '../sections/nature-pool-benefits.component';
import { EnquiryFormComponent } from '../sections/enquiry-form.component';
import { ProcessComponent } from '../sections/process.component';
import { PackageComparisonComponent } from '../sections/package-comparison.component';
import { SitePage } from '../site-page';
import { SiteShellComponent } from '../site-shell.component';
import { FAQ_ITEMS } from '../content/faunapoolen-faq';
import { NATURE_POOL_LANDING, POOL_ENQUIRY } from '../content/faunapoolen-landing';

@Component({
  selector: 'fp-nature-pools-page',
  imports: [
    GotlandPreviewComponent,
    NaturePoolBenefitsComponent,
    EnquiryFormComponent,
    ProcessComponent,
    CxHeroComponent,
    CxStackComponent,
    CxButtonComponent,
    CxListComponent,
    CxListItemComponent,
    SiteShellComponent,
    PackageComparisonComponent,
  ],
  templateUrl: './nature-pools.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NaturePoolsPage extends SitePage {
  protected readonly landing = NATURE_POOL_LANDING;
  protected readonly poolEnquiry = POOL_ENQUIRY;
  protected readonly poolEnquiryHref = this.routeFor('nature-pools') + '#consultation';
  protected readonly questions = [
    ...['space', 'care', 'consultation'].map((id) => FAQ_ITEMS.find((item) => item.id === id)!),
    ...NATURE_POOL_LANDING.questions,
    FAQ_ITEMS.find((item) => item.id === 'location')!,
  ];
}
