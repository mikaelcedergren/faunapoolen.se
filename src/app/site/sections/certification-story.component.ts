import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  CxGridComponent,
  CxStackComponent,
  CxInlineComponent,
  CxIconComponent,
} from '@mikaelcedergren/cx-framework';
import { GOTLAND_MEDIA } from '../content/faunapoolen-gotland';
import { SitePage } from '../site-page';
import { CertificationMarkComponent } from './certification-mark.component';

@Component({
  selector: 'fp-certification-story',
  imports: [
    CxGridComponent,
    CxStackComponent,
    CxInlineComponent,
    CxIconComponent,
    CertificationMarkComponent,
  ],
  templateUrl: './certification-story.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CertificationStoryComponent extends SitePage {
  protected readonly craftPhoto = GOTLAND_MEDIA.filter((item) => item.kind === 'photo').find(
    (item) => item.id === '1451',
  )!;
  protected readonly certificationStory = {
    eyebrow: $localize`:@@site.certificationStory.eyebrow:Aquascape™ certified`,
    heading: $localize`:@@site.certificationStory.heading:Your vision, in experienced hands.`,
    body: $localize`:@@site.certificationStory.body:Faunapoolen is an Aquascape™ certified contractor. We help you make confident choices, from the first sketch to caring for the finished pool.`,
    benefits: [
      {
        heading: $localize`:@@site.certificationStory.training.heading:Knowledge behind your choices`,
        body: $localize`:@@site.certificationStory.training.body:Aquascape™ trains its certified contractors in building and maintaining water features. We help you understand what suits your garden.`,
      },
      {
        heading: $localize`:@@site.certificationStory.methods.heading:Care in the construction`,
        body: $localize`:@@site.certificationStory.methods.body:Certification requires Aquascape™ construction methods and ongoing training, bringing established practices to your project.`,
      },
      {
        heading: $localize`:@@site.certificationStory.care.heading:Confidence after handover`,
        body: $localize`:@@site.certificationStory.care.body:We show you how the system works and give you a seasonal care plan, so you can settle into life by the water.`,
      },
    ],
  };
}
