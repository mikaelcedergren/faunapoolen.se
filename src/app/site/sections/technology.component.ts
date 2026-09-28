import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  CxStackComponent,
  CxGridComponent,
  CxButtonComponent,
  CxImageComponent,
  CxCardComponent,
} from '@mikaelcedergren/cx-framework';
import { SitePage } from '../site-page';

@Component({
  selector: 'fp-technology',
  imports: [
    CxStackComponent,
    CxGridComponent,
    CxButtonComponent,
    CxImageComponent,
    CxCardComponent,
  ],
  templateUrl: './technology.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TechnologyComponent extends SitePage {}
