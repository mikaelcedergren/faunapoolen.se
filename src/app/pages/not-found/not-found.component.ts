import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CxStackComponent, CxButtonComponent } from '@mikaelcedergren/cx-framework';
import { activeLanguage, languageBase } from '../../site/language';

@Component({
  selector: 'fp-not-found',
  imports: [CxStackComponent, CxButtonComponent],
  template: `
    <main class="cx-page__content">
      <cx-stack gap="lg">
        <h1 class="cx-text-display" i18n="@@notfound.h1">Page not found</h1>
        <cx-button [text]="homeLabel" [href]="homeHref" />
      </cx-stack>
    </main>
  `,
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundComponent {
  protected readonly homeHref = languageBase(activeLanguage());
  protected readonly homeLabel = $localize`:@@notfound.home:Back to home`;
}
