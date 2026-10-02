import {
  CxHeroComponent,
  CxMasonryComponent,
  CxLightboxComponent,
} from '@mikaelcedergren/cx-framework';
import { GOTLAND_COPY, GOTLAND_MEDIA, GOTLAND_STORIES } from '../content/faunapoolen-gotland';
import type { CxLightboxImage } from '@mikaelcedergren/cx-framework';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { SitePage } from '../site-page';
import { FAUNAPOOLEN_COMMERCIAL } from '../content/faunapoolen-commercial';
import { SiteShellComponent } from '../site-shell.component';
import { GotlandFilmComponent } from '../sections/gotland-film.component';
@Component({
  selector: 'fp-gotland-page',
  imports: [
    CxHeroComponent,
    CxMasonryComponent,
    CxLightboxComponent,
    SiteShellComponent,
    GotlandFilmComponent,
  ],
  templateUrl: './gotland.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GotlandPage extends SitePage {
  protected readonly commercial = FAUNAPOOLEN_COMMERCIAL;
  protected readonly gotlandCopy = GOTLAND_COPY;
  protected readonly gotlandStories = GOTLAND_STORIES;
  protected readonly gotlandPhotos = GOTLAND_MEDIA.filter((item) => item.kind === 'photo');
  protected readonly gotlandGalleryImages: CxLightboxImage[] = this.gotlandPhotos.map((photo) => ({
    src: photo.src,
    alt: photo.alt,
  }));
  protected readonly gotlandGalleryOpen = signal(false);
  protected readonly gotlandGalleryIndex = signal(0);
  protected openGotlandPhoto(event: MouseEvent, id: string): void {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0)
      return;
    event.preventDefault();
    this.gotlandGalleryIndex.set(this.gotlandPhotos.findIndex((photo) => photo.id === id));
    this.gotlandGalleryOpen.set(true);
  }
}
