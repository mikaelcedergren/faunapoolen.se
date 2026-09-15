import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  CxStackComponent,
  CxGridComponent,
  CxButtonComponent,
} from '@mikaelcedergren/cx-framework';
import { SitePage } from '../site-page';

@Component({
  selector: 'fp-technology',
  imports: [CxStackComponent, CxGridComponent, CxButtonComponent],
  templateUrl: './technology.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TechnologyComponent extends SitePage {}
