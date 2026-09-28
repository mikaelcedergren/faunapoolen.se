import { ChangeDetectionStrategy, Component, LOCALE_ID, inject } from '@angular/core';

@Component({
  selector: 'fp-why-you-should-get-a-natural-pool',
  templateUrl: './why-you-should-get-a-natural-pool.html',
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WhyYouShouldGetANaturalPoolComponent {
  protected readonly en = inject(LOCALE_ID).toLowerCase().startsWith('en');
}
