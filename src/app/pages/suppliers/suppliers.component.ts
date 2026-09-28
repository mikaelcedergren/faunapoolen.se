import { ChangeDetectionStrategy, Component, LOCALE_ID, inject } from '@angular/core';

@Component({
  selector: 'fp-suppliers',
  templateUrl: './suppliers.html',
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuppliersComponent {
  protected readonly en = inject(LOCALE_ID).toLowerCase().startsWith('en');
}
