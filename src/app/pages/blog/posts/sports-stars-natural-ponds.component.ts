import { ChangeDetectionStrategy, Component, LOCALE_ID, inject } from '@angular/core';

@Component({
  selector: 'fp-sports-stars-natural-ponds',
  templateUrl: './sports-stars-natural-ponds.html',
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SportsStarsNaturalPondsComponent {
  protected readonly en = inject(LOCALE_ID).toLowerCase().startsWith('en');
}
