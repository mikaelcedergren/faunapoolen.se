import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CxCardComponent, CxGridComponent, CxStackComponent } from '@mikaelcedergren/cx-framework';
import { POOL_COST_COMPARISON } from '../content/faunapoolen-commercial';

@Component({
  selector: 'fp-pool-cost-comparison',
  imports: [CxCardComponent, CxGridComponent, CxStackComponent],
  template: `<section
    id="pool-comparison"
    class="cx-container cx-py-lg cx-scroll-target"
    [attr.aria-label]="copy.title"
  >
    <cx-grid [columns]="3" [columnsMobile]="1" gap="xl">
      @for (item of copy.items; track item.label) {
        <cx-card [borderRadius]="24">
          <cx-stack class="cx-p-lg" gap="md">
            <h2 class="cx-font-regular">
              <span class="fp-subheading cx-font-serif cx-font-regular">{{ item.value }}</span
              ><br />
              <span class="cx-text-body-lg">{{ item.label }}</span>
            </h2>
            <p class="cx-text-body-lg cx-text-muted">{{ item.body }}</p>
          </cx-stack>
        </cx-card>
      }
    </cx-grid>
  </section>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PoolCostComparisonComponent {
  protected readonly copy = POOL_COST_COMPARISON;
}
