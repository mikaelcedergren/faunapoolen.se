import { ChangeDetectionStrategy, Component, LOCALE_ID, inject } from '@angular/core';

@Component({
  selector: 'fp-pond-packages-landing',
  templateUrl: './pond-packages-landing.html',
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PondPackagesLandingComponent {
  protected readonly en = inject(LOCALE_ID).toLowerCase().startsWith('en');
}
