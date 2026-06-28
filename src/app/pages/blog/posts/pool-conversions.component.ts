import { ChangeDetectionStrategy, Component, LOCALE_ID, inject } from '@angular/core';

@Component({
  selector: 'fp-pool-conversions',
  templateUrl: './pool-conversions.html',
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PoolConversionsComponent {
  protected readonly en = inject(LOCALE_ID).toLowerCase().startsWith('en');
}
