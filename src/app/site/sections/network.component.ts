import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CxStackComponent, CxGridComponent } from '@mikaelcedergren/cx-framework';
import { SitePage } from '../site-page';

@Component({
  selector: 'fp-network',
  imports: [CxStackComponent, CxGridComponent],
  templateUrl: './network.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NetworkComponent extends SitePage {}
