import { ChangeDetectionStrategy, Component, LOCALE_ID, inject } from '@angular/core';

@Component({
  selector: 'fp-contact',
  templateUrl: './contact.html',
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactComponent {
  protected readonly en = inject(LOCALE_ID).toLowerCase().startsWith('en');
}
