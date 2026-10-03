import {
  ChangeDetectionStrategy,
  Component,
  Input,
  booleanAttribute,
  viewChild,
} from '@angular/core';
import {
  CxCardComponent,
  CxGridComponent,
  CxButtonComponent,
  CxStackComponent,
  CxInlineComponent,
  CxDividerComponent,
} from '@mikaelcedergren/cx-framework';
import { NgTemplateOutlet } from '@angular/common';
import { CertificationMarkComponent } from './certification-mark.component';
import { NATURE_POOL_LANDING, POOL_ENQUIRY } from '../content/faunapoolen-landing';
import { NATURE_POOL_DETAILS } from '../content/faunapoolen-pool-details';
import { GOTLAND_COPY, GOTLAND_MEDIA } from '../content/faunapoolen-gotland';
import { GotlandGalleryComponent } from './gotland-gallery.component';
import { SitePage } from '../site-page';

@Component({
  selector: 'fp-gotland-preview',
  imports: [
    CxCardComponent,
    CxGridComponent,
    CxButtonComponent,
    CxStackComponent,
    CxInlineComponent,
    CxDividerComponent,
    NgTemplateOutlet,
    CertificationMarkComponent,
    GotlandGalleryComponent,
  ],
  templateUrl: './gotland-preview.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GotlandPreviewComponent extends SitePage {
  @Input({ transform: booleanAttribute }) leadFocused = false;
  @Input() enquiryHref?: string;
  @Input({ transform: booleanAttribute }) detailed = false;
  @Input({ transform: booleanAttribute }) galleryEnabled = false;
  protected readonly gallery = viewChild(GotlandGalleryComponent);
  protected readonly galleryCopy = GOTLAND_COPY;
  protected readonly details = [
    {
      id: '1437',
      title: NATURE_POOL_DETAILS.projectGardenTitle,
      body: NATURE_POOL_DETAILS.projectGardenBody,
    },
    {
      id: '1455',
      title: NATURE_POOL_DETAILS.projectStoneTitle,
      body: NATURE_POOL_DETAILS.projectStoneBody,
    },
    {
      id: '1541',
      title: NATURE_POOL_DETAILS.projectEveningTitle,
      body: NATURE_POOL_DETAILS.projectEveningBody,
    },
  ].map((item) => ({
    ...item,
    photo: GOTLAND_MEDIA.filter((media) => media.kind === 'photo').find(
      (media) => media.id === item.id,
    )!,
  }));
  protected readonly landing = NATURE_POOL_LANDING;
  protected readonly poolEnquiry = POOL_ENQUIRY;
}
