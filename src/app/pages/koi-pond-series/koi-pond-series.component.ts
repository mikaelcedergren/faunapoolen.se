import { ChangeDetectionStrategy, Component, LOCALE_ID, inject } from '@angular/core';

@Component({
  selector: 'fp-koi-pond-series',
  templateUrl: './koi-pond-series.html',
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KoiPondSeriesComponent {
  protected readonly en = inject(LOCALE_ID).toLowerCase().startsWith('en');
}
