import { ChangeDetectionStrategy, Component, LOCALE_ID, inject } from '@angular/core';

@Component({
  selector: 'fp-pricing',
  templateUrl: './pricing.html',
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PricingComponent {
  protected readonly en = inject(LOCALE_ID).toLowerCase().startsWith('en');
}
