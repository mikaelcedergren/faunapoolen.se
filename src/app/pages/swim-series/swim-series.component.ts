import { ChangeDetectionStrategy, Component, LOCALE_ID, inject } from '@angular/core';

@Component({
  selector: 'fp-swim-series',
  templateUrl: './swim-series.html',
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SwimSeriesComponent {
  protected readonly en = inject(LOCALE_ID).toLowerCase().startsWith('en');
}
