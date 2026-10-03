import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CxStackComponent } from '@mikaelcedergren/cx-framework';
import { FAUNAPOOLEN_CONTACT } from '../content/faunapoolen-contact';

@Component({
  selector: 'fp-direct-contact',
  imports: [CxStackComponent],
  template: `<div class="fp-direct-contact">
    <cx-stack gap="md" align="start">
      <a class="cx-text-body-lg" [href]="contact.phoneHref">{{ contact.phone }}</a>
      <a class="cx-text-body-lg" [href]="contact.emailHref">{{ contact.email }}</a>
    </cx-stack>
  </div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DirectContactComponent {
  protected readonly contact = FAUNAPOOLEN_CONTACT;
}
