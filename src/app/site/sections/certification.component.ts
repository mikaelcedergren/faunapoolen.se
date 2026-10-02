import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CxInlineComponent } from '@mikaelcedergren/cx-framework';
import { CertificationMarkComponent } from './certification-mark.component';
import { SitePage } from '../site-page';

@Component({
  selector: 'fp-certification',
  imports: [CxInlineComponent, CertificationMarkComponent],
  templateUrl: './certification.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CertificationComponent extends SitePage {}
