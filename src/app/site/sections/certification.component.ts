import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CxInlineComponent, CxImageComponent } from '@mikaelcedergren/cx-framework';
import { SitePage } from '../site-page';

@Component({
  selector: 'fp-certification',
  imports: [CxInlineComponent, CxImageComponent],
  templateUrl: './certification.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CertificationComponent extends SitePage {}
