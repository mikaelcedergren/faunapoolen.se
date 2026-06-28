import { ChangeDetectionStrategy, Component, LOCALE_ID, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'fp-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  /** True in the English (/en/) build. Drives the locale-gated chrome. */
  protected readonly en = inject(LOCALE_ID).toLowerCase().startsWith('en');
}
