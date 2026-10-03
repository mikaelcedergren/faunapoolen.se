import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SitePage } from '../site-page';
import { SiteShellComponent } from '../site-shell.component';
import { EnquiryFormComponent } from '../sections/enquiry-form.component';
import { POOL_ENQUIRY } from '../content/faunapoolen-landing';

@Component({
  selector: 'fp-configure-page',
  imports: [SiteShellComponent, EnquiryFormComponent],
  templateUrl: './configure.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfigurePage extends SitePage {
  protected readonly poolEnquiry = POOL_ENQUIRY;
  protected readonly poolJourney =
    this.routeSnapshot.queryParamMap.get('service') === 'pool' ||
    this.packageIds.some((id) => id === this.routeSnapshot.queryParamMap.get('package'));
}
