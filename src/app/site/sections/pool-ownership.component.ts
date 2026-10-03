import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  CxGridComponent,
  CxStackComponent,
  CxListComponent,
  CxListItemComponent,
} from '@mikaelcedergren/cx-framework';
import { POOL_OWNERSHIP } from '../content/faunapoolen-ownership';

@Component({
  selector: 'fp-pool-ownership',
  imports: [CxGridComponent, CxStackComponent, CxListComponent, CxListItemComponent],
  template: `<section
    id="pool-care"
    class="cx-container fp-section"
    aria-labelledby="pool-care-title"
  >
    <cx-grid [columns]="2" [columnsMobile]="1" gap="2xl" align="start">
      <cx-stack gap="xl">
        <h2 id="pool-care-title" class="fp-heading cx-font-serif cx-font-regular">
          {{ copy.title }}
        </h2>
        <p class="cx-editorial">{{ copy.intro }}</p>
        <p class="cx-editorial">{{ copy.body }}</p>
      </cx-stack>
      <cx-list>
        @for (item of copy.items; track item.id) {
          <cx-list-item
            [itemId]="item.id"
            [heading]="item.title"
            [description]="item.answer"
            expandable
          >
            <p class="cx-text-body">{{ item.detail }}</p>
          </cx-list-item>
        }
      </cx-list>
    </cx-grid>
  </section>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PoolOwnershipComponent {
  protected readonly copy = POOL_OWNERSHIP;
}
