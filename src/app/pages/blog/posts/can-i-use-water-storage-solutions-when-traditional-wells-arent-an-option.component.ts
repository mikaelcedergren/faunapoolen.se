import { ChangeDetectionStrategy, Component, LOCALE_ID, inject } from '@angular/core';

@Component({
  selector: 'fp-can-i-use-water-storage-solutions-when-traditional-wells-arent-an-option',
  templateUrl: './can-i-use-water-storage-solutions-when-traditional-wells-arent-an-option.html',
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CanIUseWaterStorageSolutionsWhenTraditionalWellsArentAnOptionComponent {
  protected readonly en = inject(LOCALE_ID).toLowerCase().startsWith('en');
}
