import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { SitePage } from '../site-page';

@Component({
  selector: 'fp-customer-quote',
  imports: [],
  templateUrl: './customer-quote.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerQuoteComponent extends SitePage {
  readonly review = input.required<(typeof this.testimonials)[number]>();
}
