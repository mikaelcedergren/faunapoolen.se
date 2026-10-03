import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CxStateMessageComponent } from '@mikaelcedergren/cx-framework';
import { FAUNAPOOLEN_COPY } from '../content/faunapoolen-content';
import { PublicPackageCatalogue } from '../package-catalogue';

export const GUIDE_PRICE_HEADING = $localize`:@@site.guidePrices.heading:What does a nature pool cost?`;

/** The buying guide uses the same current offer as the package page. */
@Component({
  selector: 'fp-guide-prices',
  imports: [CxStateMessageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="cx-editorial cx-pb-lg" aria-labelledby="guide-prices">
      <h2 id="guide-prices" class="fp-heading cx-font-regular cx-scroll-target">{{ heading }}</h2>
      <p>{{ introduction }}</p>
      @if (catalogue.loading()) {
        <cx-state-message state="pending" [heading]="loading" />
      } @else if (catalogue.error()) {
        <cx-state-message
          state="danger"
          [heading]="unavailable"
          [action]="{ text: retry }"
          (action)="catalogue.reload()"
        />
      } @else {
        <ul>
          @for (item of catalogue.packages(); track item.id) {
            <li>
              <strong>{{ item.name }}: {{ copy.common.from }} {{ catalogue.price(item) }}</strong
              >. {{ item.area }}. {{ item.description }}
            </li>
          }
        </ul>
      }
      <p>{{ exclusions }} {{ qualification }}</p>
    </section>
  `,
})
export class GuidePricesComponent {
  protected readonly catalogue = inject(PublicPackageCatalogue);
  protected readonly copy = FAUNAPOOLEN_COPY;
  protected readonly heading = GUIDE_PRICE_HEADING;
  protected readonly introduction = $localize`:@@site.guidePrices.introduction:Faunapoolen’s current package starting prices give you a first budget for a pool we design and build. The three sizes help you compare a place for daily dips, swimming together or a larger water garden.`;
  protected readonly qualification = $localize`:@@site.guidePrices.qualification:These are starting prices for the package scope, not a total quotation for your garden. Ground conditions, access and the additional work described below affect the final cost.`;
  protected readonly exclusions = $localize`:@@site.guidePrices.exclusions:All starting prices exclude VAT and shipping.`;
  protected readonly loading = $localize`:@@packages.loading:Loading packages`;
  protected readonly unavailable = $localize`:@@packages.unavailable:Packages could not be loaded. Try again or contact us about your pool.`;
  protected readonly retry = $localize`:@@packages.retry:Try again`;
}
