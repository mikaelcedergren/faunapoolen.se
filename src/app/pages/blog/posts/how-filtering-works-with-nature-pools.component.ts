import { ChangeDetectionStrategy, Component, LOCALE_ID, inject } from '@angular/core';

@Component({
  selector: 'fp-how-filtering-works-with-nature-pools',
  templateUrl: './how-filtering-works-with-nature-pools.html',
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HowFilteringWorksWithNaturePoolsComponent {
  protected readonly en = inject(LOCALE_ID).toLowerCase().startsWith('en');
}
