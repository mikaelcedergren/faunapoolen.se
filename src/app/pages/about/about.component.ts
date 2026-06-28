import { ChangeDetectionStrategy, Component, LOCALE_ID, inject } from '@angular/core';

@Component({
  selector: 'fp-about',
  templateUrl: './about.html',
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutComponent {
  protected readonly en = inject(LOCALE_ID).toLowerCase().startsWith('en');
}
