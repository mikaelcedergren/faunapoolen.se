import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  CxCardComponent,
  CxGridComponent,
  CxParallaxDirective,
  CxStackComponent,
} from '@mikaelcedergren/cx-framework';
import { POOL_AFTERCARE } from '../content/faunapoolen-ownership';

@Component({
  selector: 'fp-pool-aftercare',
  imports: [CxCardComponent, CxGridComponent, CxParallaxDirective, CxStackComponent],
  template: `<section aria-labelledby="aftercare-title">
    <div class="fp-process-scene">
      <img
        class="fp-process-scene-media"
        cxParallax
        src="/assets/images/faunapoolen/editorial/aftercare-evening.webp"
        alt=""
        aria-hidden="true"
        loading="lazy"
        width="1672"
        height="941"
      />
      <div class="cx-container fp-section">
        <cx-stack gap="xl">
          <h2 id="aftercare-title" class="fp-heading cx-font-serif cx-font-regular">
            {{ copy.title }}
          </h2>
          <cx-grid [columns]="3" [columnsMobile]="1" gap="2xl">
            <cx-card variant="frosted">
              <div class="cx-p-lg">
                <cx-stack gap="md" align="start">
                  <h3 class="fp-subheading cx-font-serif cx-font-regular">
                    {{ copy.guaranteeTitle }}
                  </h3>
                  <p class="cx-editorial">{{ copy.guaranteeBody }}</p>
                </cx-stack>
              </div>
            </cx-card>
            @for (item of copy.items; track item.title) {
              <cx-card variant="frosted">
                <div class="cx-p-lg">
                  <cx-stack gap="md" align="start">
                    <h3 class="fp-subheading cx-font-serif cx-font-regular">{{ item.title }}</h3>
                    <p class="cx-editorial">{{ item.body }}</p>
                  </cx-stack>
                </div>
              </cx-card>
            }
          </cx-grid>
          <p class="fp-body cx-text-muted cx-text-center cx-measure-lg">{{ copy.terms }}</p>
        </cx-stack>
      </div>
    </div>
  </section>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PoolAftercareComponent {
  protected readonly copy = POOL_AFTERCARE;
}
