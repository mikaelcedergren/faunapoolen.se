import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CxButtonComponent } from '@mikaelcedergren/cx-framework';
import { FAUNAPOOLEN_COPY } from '../content/faunapoolen-content';
import { SitePage } from '../site-page';

@Component({
  selector: 'fp-contact-invitation',
  imports: [CxButtonComponent],
  templateUrl: './contact-invitation.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactInvitationComponent extends SitePage {
  protected readonly copy = FAUNAPOOLEN_COPY;

  @Input() href?: string;
  protected readonly invitationBody = $localize`:@@site.invitation.body:Let’s talk about your garden. Your first phone consultation is free.`;
}
