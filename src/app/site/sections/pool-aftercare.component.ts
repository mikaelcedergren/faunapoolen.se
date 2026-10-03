import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CxGridComponent, CxStackComponent } from '@mikaelcedergren/cx-framework';
import { POOL_AFTERCARE } from '../content/faunapoolen-ownership';

@Component({
  selector: 'fp-pool-aftercare',
  imports: [CxGridComponent, CxStackComponent],
  template: `<section class="fp-band">
    <div class="cx-container fp-section">
      <cx-stack gap="xl">
        <h2 class="fp-heading cx-font-serif cx-font-regular">{{ copy.title }}</h2>
        <cx-grid [columns]="3" [columnsMobile]="1" gap="xl">
          @for (item of copy.items; track item.title) {
            <cx-stack class="fp-column" gap="md">
              <h3 class="fp-subheading cx-font-serif cx-font-regular">{{ item.title }}</h3>
              <p class="cx-editorial">{{ item.body }}</p>
            </cx-stack>
          }
        </cx-grid>
        <p class="cx-text-body-sm cx-text-muted cx-text-center cx-measure-lg">{{ copy.terms }}</p>
      </cx-stack>
    </div>
  </section>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PoolAftercareComponent {
  protected readonly copy = POOL_AFTERCARE;
}
