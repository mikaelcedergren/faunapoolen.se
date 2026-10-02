import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SitePage } from '../site-page';

@Component({
  selector: 'fp-certification-mark',
  template: `
    <img
      class="fp-certification-mark"
      [class.fp-certification-mark--large]="large()"
      [src]="aquascapeImages.certificationEmblem"
      [alt]="'Aquascape™ — ' + editorial.contractorLabel"
      width="56"
      height="56"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CertificationMarkComponent extends SitePage {
  readonly large = input(false);
}
