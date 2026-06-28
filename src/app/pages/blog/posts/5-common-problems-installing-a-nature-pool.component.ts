import { ChangeDetectionStrategy, Component, LOCALE_ID, inject } from '@angular/core';

@Component({
  selector: 'fp-5-common-problems-installing-a-nature-pool',
  templateUrl: './5-common-problems-installing-a-nature-pool.html',
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Page5CommonProblemsInstallingANaturePoolComponent {
  protected readonly en = inject(LOCALE_ID).toLowerCase().startsWith('en');
}
