import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FAUNAPOOLEN_EDITORIAL } from '../content/faunapoolen-editorial';
import { CertificationMarkComponent } from './certification-mark.component';

@Component({
  selector: 'fp-certification-strip',
  imports: [CertificationMarkComponent],
  template: `
    <div class="fp-certification-strip">
      <div class="cx-container">
        <div class="fp-certification-line">
          <span>{{ editorial.trustExpertise }}</span>
          <div class="fp-certification-stamp">
            <fp-certification-mark [large]="true" />
          </div>
          <span>{{ editorial.trustStandards }}</span>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CertificationStripComponent {
  protected readonly editorial = FAUNAPOOLEN_EDITORIAL;
}
