import { DomSanitizer } from '@angular/platform-browser';
import { type GotlandFilm } from '../content/faunapoolen-gotland';
import { ChangeDetectionStrategy, Component, input, computed, inject, signal } from '@angular/core';
import { CxIconComponent } from '@mikaelcedergren/cx-framework';

@Component({
  selector: 'fp-gotland-film',
  imports: [CxIconComponent],
  templateUrl: './gotland-film.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GotlandFilmComponent {
  readonly film = input.required<GotlandFilm>();
  readonly heading = input.required<string>();
  protected readonly playing = signal(false);
  protected readonly poster = computed(
    () => '/assets/images/faunapoolen/gotland/film-' + this.film().id + '.webp',
  );
  protected readonly playLabel = computed(
    () => $localize`:@@site.gotland.playFilm:Play video: ${this.heading()}:heading:`,
  );
  readonly embedUrl = computed(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(
      'https://player.vimeo.com/video/' +
        this.film().id +
        '?dnt=1&autoplay=1&autopause=1&playsinline=1&badge=0&title=0&byline=0&portrait=0',
    ),
  );
  private readonly sanitizer = inject(DomSanitizer);
}
