import {
  CxButtonComponent,
  CxDividerComponent,
  CxHeroComponent,
  CxMasonryComponent,
} from '@mikaelcedergren/cx-framework';
import { GOTLAND_COPY, GOTLAND_MEDIA, GOTLAND_STORIES } from '../content/faunapoolen-gotland';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SitePage } from '../site-page';
import { FAUNAPOOLEN_COMMERCIAL } from '../content/faunapoolen-commercial';
import { SiteShellComponent } from '../site-shell.component';
import { GotlandGalleryComponent } from '../sections/gotland-gallery.component';
import { GotlandFilmComponent } from '../sections/gotland-film.component';
import { CertificationStripComponent } from '../sections/certification-strip.component';
@Component({
  selector: 'fp-gotland-page',
  imports: [
    CertificationStripComponent,
    CxButtonComponent,
    CxDividerComponent,
    CxHeroComponent,
    CxMasonryComponent,
    SiteShellComponent,
    GotlandFilmComponent,
    GotlandGalleryComponent,
  ],
  templateUrl: './gotland.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GotlandPage extends SitePage {
  protected readonly commercial = FAUNAPOOLEN_COMMERCIAL;
  protected readonly gotlandCopy = GOTLAND_COPY;
  protected readonly gotlandStories = GOTLAND_STORIES;
  protected readonly gotlandPhotos = GOTLAND_MEDIA.filter((item) => item.kind === 'photo');
}
