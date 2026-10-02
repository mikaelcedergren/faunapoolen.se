import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import {
  CxCardComponent,
  CxStackComponent,
  CxGridComponent,
  CxParallaxDirective,
} from '@mikaelcedergren/cx-framework';
import { SitePage } from '../site-page';

@Component({
  selector: 'fp-process',
  imports: [CxCardComponent, CxStackComponent, CxGridComponent, CxParallaxDirective],
  templateUrl: './process.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessComponent extends SitePage {
  @Input() steps = this.process;
}
