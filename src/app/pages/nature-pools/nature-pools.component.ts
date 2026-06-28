import { ChangeDetectionStrategy, Component, LOCALE_ID, inject } from '@angular/core';

@Component({
  selector: 'fp-nature-pools',
  templateUrl: './nature-pools.html',
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NaturePoolsComponent {
  protected readonly en = inject(LOCALE_ID).toLowerCase().startsWith('en');
}
