import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CxButtonComponent, CxStackComponent } from '@mikaelcedergren/cx-framework';
import { SitePage } from '../site-page';

@Component({
  selector: 'fp-contact-invitation',
  imports: [CxButtonComponent, CxStackComponent],
  templateUrl: './contact-invitation.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactInvitationComponent extends SitePage {
  protected readonly invitationBody = $localize`:@@site.invitation.body:Whether you’re ready to start or still deciding what suits your garden, we’ll help you explore a nature pool, pond or waterfall designed and built by Faunapoolen. We’ll discuss your ideas, budget and timing, and the next steps towards making it happen.`;
  protected readonly pricesLabel = $localize`:@@site.invitation.prices:See prices`;
}
