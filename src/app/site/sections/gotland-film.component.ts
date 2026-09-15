import { DomSanitizer } from '@angular/platform-browser';
import { GOTLAND_COPY, type GotlandFilm } from '../content/faunapoolen-gotland';
import { ChangeDetectionStrategy, Component, input, computed, inject } from '@angular/core';

import { SitePage } from '../site-page';

@Component({
  selector: 'fp-gotland-film',
  imports: [],
  templateUrl: './gotland-film.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GotlandFilmComponent extends SitePage {
  readonly film = input.required<GotlandFilm>();
  readonly embedUrl = computed(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(
      'https://player.vimeo.com/video/' +
        this.film().id +
        '?dnt=1&autoplay=0&autopause=1&playsinline=1&badge=0',
    ),
  );
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly gotlandCopy = GOTLAND_COPY;
}
