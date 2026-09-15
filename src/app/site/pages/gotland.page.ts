import { GOTLAND_COPY, GOTLAND_MEDIA } from '../content/faunapoolen-gotland';
import type { CxLightboxImage } from '@mikaelcedergren/cx-framework';
import { ChangeDetectionStrategy, Component, signal, inject } from '@angular/core';
import {
  CxStackComponent,
  CxMasonryComponent,
  CxLightboxComponent,
} from '@mikaelcedergren/cx-framework';
import { SitePage } from '../site-page';
import { SiteShellComponent } from '../site-shell.component';
import { GotlandFilmComponent } from '../sections/gotland-film.component';
@Component({
  selector: 'fp-gotland-page',
  imports: [
    CxStackComponent,
    CxMasonryComponent,
    CxLightboxComponent,
    SiteShellComponent,
    GotlandFilmComponent,
  ],
  templateUrl: './gotland.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GotlandPage extends SitePage {
  protected readonly gotlandCopy = GOTLAND_COPY;
  protected readonly gotlandMedia = GOTLAND_MEDIA;
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
