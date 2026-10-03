import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AQUASCAPE_IMAGES } from '../content/faunapoolen-brand';
import { FAUNAPOOLEN_EDITORIAL } from '../content/faunapoolen-editorial';

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
export class CertificationMarkComponent {
  protected readonly aquascapeImages = AQUASCAPE_IMAGES;
  protected readonly editorial = FAUNAPOOLEN_EDITORIAL;

  readonly large = input(false);
}
