import { ChangeDetectionStrategy, Component, LOCALE_ID, inject } from '@angular/core';

@Component({
  selector: 'fp-waterfront-series',
  templateUrl: './waterfront-series.html',
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WaterfrontSeriesComponent {
  protected readonly en = inject(LOCALE_ID).toLowerCase().startsWith('en');
}
