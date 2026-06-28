import { ChangeDetectionStrategy, Component, LOCALE_ID, inject } from '@angular/core';

@Component({
  selector: 'fp-creating-harmony-intergrating-water-features-with-your-landscape',
  templateUrl: './creating-harmony-intergrating-water-features-with-your-landscape.html',
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreatingHarmonyIntergratingWaterFeaturesWithYourLandscapeComponent {
  protected readonly en = inject(LOCALE_ID).toLowerCase().startsWith('en');
}
