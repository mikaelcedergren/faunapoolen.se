import { ChangeDetectionStrategy, Component, LOCALE_ID, inject } from '@angular/core';

@Component({
  selector: 'fp-build-your-own-nature-pool',
  templateUrl: './build-your-own-nature-pool.html',
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuildYourOwnNaturePoolComponent {
  protected readonly en = inject(LOCALE_ID).toLowerCase().startsWith('en');
}
