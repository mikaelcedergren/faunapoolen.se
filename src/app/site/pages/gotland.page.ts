import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  CxButtonComponent,
  CxDividerComponent,
  CxGridComponent,
  CxHeroComponent,
  CxMasonryComponent,
  CxStackComponent,
} from '@mikaelcedergren/cx-framework';
import { FAUNAPOOLEN_COMMERCIAL } from '../content/faunapoolen-commercial';
import { FAUNAPOOLEN_EDITORIAL } from '../content/faunapoolen-editorial';
import {
  FAUNAPOOLEN_EVIDENCE_COPY,
  FAUNAPOOLEN_TESTIMONIALS,
} from '../content/faunapoolen-evidence';
import {
  GOTLAND_AFTER,
  GOTLAND_BEFORE,
  GOTLAND_COPY,
  GOTLAND_MEDIA,
  GOTLAND_STORIES,
} from '../content/faunapoolen-gotland';
import { CertificationStripComponent } from '../sections/certification-strip.component';
import { GotlandFilmComponent } from '../sections/gotland-film.component';
import { GotlandGalleryComponent } from '../sections/gotland-gallery.component';
import { SitePage } from '../site-page';
import { SiteShellComponent } from '../site-shell.component';
@Component({
  selector: 'fp-gotland-page',
  imports: [
    CertificationStripComponent,
    CxButtonComponent,
    CxDividerComponent,
    CxGridComponent,
    CxHeroComponent,
    CxMasonryComponent,
    CxStackComponent,
    SiteShellComponent,
    GotlandFilmComponent,
    GotlandGalleryComponent,
  ],
  templateUrl: './gotland.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GotlandPage extends SitePage {
  protected readonly projectPhoto = GOTLAND_MEDIA.find((item) => item.kind === 'photo')!;
  protected readonly testimonials = FAUNAPOOLEN_TESTIMONIALS;
  protected readonly evidence = FAUNAPOOLEN_EVIDENCE_COPY;
  protected readonly editorial = FAUNAPOOLEN_EDITORIAL;

  protected readonly commercial = FAUNAPOOLEN_COMMERCIAL;
  protected readonly gotlandCopy = GOTLAND_COPY;
  protected readonly gotlandBefore = GOTLAND_BEFORE;
  protected readonly gotlandAfter = GOTLAND_AFTER;
  protected readonly gotlandStories = GOTLAND_STORIES;
  protected readonly gotlandPhotos = GOTLAND_MEDIA.filter((item) => item.kind === 'photo');
}
