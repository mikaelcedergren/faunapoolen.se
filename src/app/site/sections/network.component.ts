import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  CxStackComponent,
  CxGridComponent,
  CxButtonComponent,
} from '@mikaelcedergren/cx-framework';
import { SitePage } from '../site-page';

@Component({
  selector: 'fp-network',
  imports: [CxStackComponent, CxGridComponent, CxButtonComponent],
  templateUrl: './network.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NetworkComponent extends SitePage {}
