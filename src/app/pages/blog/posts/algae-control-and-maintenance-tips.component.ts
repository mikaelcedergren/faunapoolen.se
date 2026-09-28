import { ChangeDetectionStrategy, Component, LOCALE_ID, inject } from '@angular/core';

@Component({
  selector: 'fp-algae-control-and-maintenance-tips',
  templateUrl: './algae-control-and-maintenance-tips.html',
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlgaeControlAndMaintenanceTipsComponent {
  protected readonly en = inject(LOCALE_ID).toLowerCase().startsWith('en');
}
