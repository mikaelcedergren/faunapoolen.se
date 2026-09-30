import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CxStackComponent, CxGridComponent } from '@mikaelcedergren/cx-framework';
import { SitePage } from '../site-page';

@Component({
  selector: 'fp-process',
  imports: [CxStackComponent, CxGridComponent],
  templateUrl: './process.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessComponent extends SitePage {}
