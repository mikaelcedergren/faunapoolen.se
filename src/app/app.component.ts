import { ChangeDetectionStrategy, Component, LOCALE_ID, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

@Component({
  selector: 'fp-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private readonly router = inject(Router);

  /** True in the English (/en/) build. Drives the locale-gated chrome. */
  protected readonly en = inject(LOCALE_ID).toLowerCase().startsWith('en');

  /** Admin owns its own cx-framework shell, so the public chrome stays out of that surface. */
  protected readonly admin = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => this.isAdminUrl(event.urlAfterRedirects)),
      startWith(this.isAdminUrl(this.router.url)),
    ),
    { initialValue: false },
  );

  private isAdminUrl(url: string): boolean {
    return /^\/(?:en\/)?admin(?:[/?#]|$)/.test(url);
  }
}
