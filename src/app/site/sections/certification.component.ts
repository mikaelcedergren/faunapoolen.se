import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CxInlineComponent } from '@mikaelcedergren/cx-framework';
import { FAUNAPOOLEN_EDITORIAL } from '../content/faunapoolen-editorial';
import { FAUNAPOOLEN_EVIDENCE_COPY } from '../content/faunapoolen-evidence';
import { SitePage } from '../site-page';
import { CertificationMarkComponent } from './certification-mark.component';

@Component({
  selector: 'fp-certification',
  imports: [CxInlineComponent, CertificationMarkComponent],
  templateUrl: './certification.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CertificationComponent extends SitePage {
  protected readonly evidence = FAUNAPOOLEN_EVIDENCE_COPY;
  protected readonly editorial = FAUNAPOOLEN_EDITORIAL;
}
