import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CxLightboxComponent, type CxLightboxImage } from '@mikaelcedergren/cx-framework';
import { GOTLAND_COPY, GOTLAND_MEDIA } from '../content/faunapoolen-gotland';
import { SitePage } from '../site-page';

@Component({
  selector: 'fp-gotland-gallery',
  imports: [CxLightboxComponent],
  template: `
    <cx-lightbox
      [images]="galleryImages"
      [open]="open()"
      [index]="index()"
      (indexChange)="index.set($event)"
      (openChange)="open.set($event)"
      [ariaLabel]="evidence.caseTitle"
      [previousAriaLabel]="galleryCopy.previous"
      [nextAriaLabel]="galleryCopy.next"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GotlandGalleryComponent extends SitePage {
  private readonly photos = GOTLAND_MEDIA.filter((item) => item.kind === 'photo');
  protected readonly galleryImages: CxLightboxImage[] = this.photos.map(({ src, alt }) => ({
    src,
    alt,
  }));
  protected readonly galleryCopy = GOTLAND_COPY;
  protected readonly open = signal(false);
  protected readonly index = signal(0);

  show(id = this.photos[0].id): void {
    this.index.set(this.photos.findIndex((photo) => photo.id === id));
    this.open.set(true);
  }

  openPhoto(event: MouseEvent, id: string): void {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0)
      return;
    event.preventDefault();
    this.show(id);
  }
}
