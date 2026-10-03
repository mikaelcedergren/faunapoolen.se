import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  CxButtonComponent,
  CxDividerComponent,
  CxGridComponent,
  CxHeroComponent,
  CxListComponent,
  CxListItemComponent,
  CxSkeletonLoaderComponent,
  CxStackComponent,
} from '@mikaelcedergren/cx-framework';
import { FAUNAPOOLEN_IMAGES } from '../content/faunapoolen-brand';
import { FAUNAPOOLEN_COMMERCIAL } from '../content/faunapoolen-commercial';
import { FAUNAPOOLEN_COPY } from '../content/faunapoolen-content';
import { NATURE_POOL_LANDING, POOL_ENQUIRY } from '../content/faunapoolen-landing';
import { PublicPackageCatalogue } from '../package-catalogue';
import { CertificationStripComponent } from '../sections/certification-strip.component';
import { DirectContactComponent } from '../sections/direct-contact.component';
import { EnquiryFormComponent } from '../sections/enquiry-form.component';
import { PackageComparisonComponent } from '../sections/package-comparison.component';
import { PoolAftercareComponent } from '../sections/pool-aftercare.component';
import { PoolOwnershipComponent } from '../sections/pool-ownership.component';
import { ProcessComponent } from '../sections/process.component';
import { SitePage } from '../site-page';
import { SiteShellComponent } from '../site-shell.component';

@Component({
  selector: 'fp-pricing-page',
  imports: [
    CertificationStripComponent,
    DirectContactComponent,
    EnquiryFormComponent,
    PoolOwnershipComponent,
    PoolAftercareComponent,
    CxButtonComponent,
    CxDividerComponent,
    CxGridComponent,
    CxHeroComponent,
    CxSkeletonLoaderComponent,
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
  protected readonly packageCatalogue = inject(PublicPackageCatalogue);
  protected readonly images = FAUNAPOOLEN_IMAGES;
  protected readonly copy = FAUNAPOOLEN_COPY;

  // A nine-digit sample covers the catalogue's supported price range. It is
  // measurement text only, never a displayed or announced offer.
  protected readonly priceReservation = `${this.copy.common.from} ${this.packageCatalogue.money(888888888)} · ${this.copy.common.priceExclusions}`;
  protected readonly priceUnavailable = $localize`:@@packages.priceUnavailable:Price unavailable`;
  protected readonly poolEnquiryHref = this.routeFor('pricing') + '#consultation';
  protected readonly poolEnquiry = POOL_ENQUIRY;
  protected readonly commercial = FAUNAPOOLEN_COMMERCIAL;
  protected readonly pricingImageAlt = $localize`:@@site.pricing.imageAlt:Concept image of water droplets on planting beside a natural stone pool edge, with warm evening reflections.`;
  protected readonly factors = [
    { title: this.commercial.groundTitle, body: this.commercial.groundBody },
    { title: this.commercial.sizeTitle, body: this.commercial.sizeBody },
    { title: this.commercial.surroundingsTitle, body: this.commercial.surroundingsBody },
  ];
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
      id: 'ready',
      heading: this.commercial.pricingQuestionTitle,
      body: this.commercial.pricingQuestionBody,
      detail: '',
    },
  ];
}
