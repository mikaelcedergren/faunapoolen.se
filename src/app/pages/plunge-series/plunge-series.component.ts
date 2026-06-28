import { ChangeDetectionStrategy, Component, LOCALE_ID, inject } from '@angular/core';

@Component({
  selector: 'fp-plunge-series',
  templateUrl: './plunge-series.html',
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlungeSeriesComponent {
  protected readonly en = inject(LOCALE_ID).toLowerCase().startsWith('en');
}
