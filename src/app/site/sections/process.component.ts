import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import {
  CxCardComponent,
  CxGridComponent,
  CxParallaxDirective,
  CxStackComponent,
} from '@mikaelcedergren/cx-framework';
import { FAUNAPOOLEN_COPY, FAUNAPOOLEN_PROCESS } from '../content/faunapoolen-content';

@Component({
  selector: 'fp-process',
  imports: [CxCardComponent, CxStackComponent, CxGridComponent, CxParallaxDirective],
  templateUrl: './process.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessComponent {
  protected readonly process = FAUNAPOOLEN_PROCESS;
  protected readonly copy = FAUNAPOOLEN_COPY;

  @Input() steps = this.process;
}
