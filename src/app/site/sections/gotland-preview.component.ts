import { ChangeDetectionStrategy, Component, Input, booleanAttribute } from '@angular/core';
import {
  CxCardComponent,
  CxGridComponent,
  CxButtonComponent,
  CxStackComponent,
  CxInlineComponent,
} from '@mikaelcedergren/cx-framework';
import { NgTemplateOutlet } from '@angular/common';
import { CertificationMarkComponent } from './certification-mark.component';
import { NATURE_POOL_LANDING, POOL_ENQUIRY } from '../content/faunapoolen-landing';
import { SitePage } from '../site-page';

@Component({
  selector: 'fp-gotland-preview',
  imports: [
    CxCardComponent,
    CxGridComponent,
    CxButtonComponent,
    CxStackComponent,
    CxInlineComponent,
    NgTemplateOutlet,
    CertificationMarkComponent,
  ],
  templateUrl: './gotland-preview.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GotlandPreviewComponent extends SitePage {
  @Input({ transform: booleanAttribute }) leadFocused = false;
  @Input() enquiryHref?: string;
  protected readonly landing = NATURE_POOL_LANDING;
  protected readonly poolEnquiry = POOL_ENQUIRY;
}
