import { ChangeDetectionStrategy, Component, LOCALE_ID, inject } from '@angular/core';

@Component({
  selector: 'fp-how-faunapoolen-helps-golf-clubs-manage-ponds-lakes-and-streams',
  templateUrl: './how-faunapoolen-helps-golf-clubs-manage-ponds-lakes-and-streams.html',
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HowFaunapoolenHelpsGolfClubsManagePondsLakesAndStreamsComponent {
  protected readonly en = inject(LOCALE_ID).toLowerCase().startsWith('en');
}
