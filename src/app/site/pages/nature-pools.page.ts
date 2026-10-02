import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  CxHeroComponent,
  CxStackComponent,
  CxButtonComponent,
  CxListComponent,
  CxListItemComponent,
  CxGridComponent,
  CxInlineComponent,
  CxIconComponent,
} from '@mikaelcedergren/cx-framework';
import { GotlandPreviewComponent } from '../sections/gotland-preview.component';
import { NATURE_POOL_DETAILS } from '../content/faunapoolen-pool-details';
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
    CxGridComponent,
    CxInlineComponent,
    CxIconComponent,
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
  styleUrl: './nature-pools.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NaturePoolsPage extends SitePage {
  protected readonly landing = NATURE_POOL_LANDING;
  protected readonly detail = NATURE_POOL_DETAILS;
  protected readonly filtration = [
    { title: this.detail.filterCollectTitle, body: this.detail.filterCollectBody },
    { title: this.detail.filterBioTitle, body: this.detail.filterBioBody },
    { title: this.detail.filterReturnTitle, body: this.detail.filterReturnBody },
  ];
  protected readonly layout = [
    { title: this.detail.fitSwimTitle, body: this.detail.fitSwimBody },
    { title: this.detail.fitFilterTitle, body: this.detail.fitFilterBody },
    { title: this.detail.fitEdgeTitle, body: this.detail.fitEdgeBody },
  ];
  protected readonly care = [
    { title: this.detail.careRoutineTitle, body: this.detail.careRoutineBody },
    { title: this.detail.careSeasonTitle, body: this.detail.careSeasonBody },
    { title: this.detail.careSupportTitle, body: this.detail.careSupportBody },
  ];
  protected readonly poolEnquiry = POOL_ENQUIRY;
  protected readonly poolEnquiryHref = this.routeFor('nature-pools') + '#consultation';
  protected readonly questions = [
    ...['space', 'consultation'].map((id) => FAQ_ITEMS.find((item) => item.id === id)!),
    ...NATURE_POOL_LANDING.questions,
    FAQ_ITEMS.find((item) => item.id === 'location')!,
  ];
}
