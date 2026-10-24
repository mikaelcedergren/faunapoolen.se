import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PACKAGE_IDS } from '../../../../server/src/package-contracts';
import { FAUNAPOOLEN_COPY } from '../content/faunapoolen-content';
import { POOL_ENQUIRY } from '../content/faunapoolen-landing';
import { DirectContactComponent } from '../sections/direct-contact.component';
import { EnquiryFormComponent } from '../sections/enquiry-form.component';
import { SitePage } from '../site-page';
import { SiteShellComponent } from '../site-shell.component';

@Component({
  selector: 'fp-configure-page',
  imports: [DirectContactComponent, SiteShellComponent, EnquiryFormComponent],
  templateUrl: './configure.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfigurePage extends SitePage {
  protected readonly packageIds = PACKAGE_IDS;
  protected readonly copy = FAUNAPOOLEN_COPY;

  protected readonly poolEnquiry = POOL_ENQUIRY;
  protected readonly poolJourney =
    this.routeSnapshot.queryParamMap.get('service') === 'pool' ||
    this.packageIds.some((id) => id === this.routeSnapshot.queryParamMap.get('package'));
}
