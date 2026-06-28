import { ChangeDetectionStrategy, Component, LOCALE_ID, inject } from '@angular/core';

@Component({
  selector: 'fp-small-features-for-small-spaces',
  templateUrl: './small-features-for-small-spaces.html',
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SmallFeaturesForSmallSpacesComponent {
  protected readonly en = inject(LOCALE_ID).toLowerCase().startsWith('en');
}
