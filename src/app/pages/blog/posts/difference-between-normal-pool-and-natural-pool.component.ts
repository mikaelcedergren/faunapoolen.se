import { ChangeDetectionStrategy, Component, LOCALE_ID, inject } from '@angular/core';

@Component({
  selector: 'fp-difference-between-normal-pool-and-natural-pool',
  templateUrl: './difference-between-normal-pool-and-natural-pool.html',
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DifferenceBetweenNormalPoolAndNaturalPoolComponent {
  protected readonly en = inject(LOCALE_ID).toLowerCase().startsWith('en');
}
