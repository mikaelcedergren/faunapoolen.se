import { ChangeDetectionStrategy, Component, LOCALE_ID, inject } from '@angular/core';

@Component({
  selector: 'fp-services',
  templateUrl: './services.html',
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicesComponent {
  protected readonly en = inject(LOCALE_ID).toLowerCase().startsWith('en');
}
