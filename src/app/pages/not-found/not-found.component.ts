import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CxStackComponent, CxButtonComponent } from '@mikaelcedergren/cx-framework';
import { activeLanguage, languageBase } from '../../site/language';

@Component({
  selector: 'fp-not-found',
  imports: [CxStackComponent, CxButtonComponent],
  template: `
    <div class="cx-page">
      <main class="cx-container cx-py-2xl">
        <cx-stack gap="lg" align="start">
          <h1 class="cx-text-display cx-font-serif cx-font-regular" i18n="@@notfound.h1">
            Page not found
          </h1>
          <cx-button [text]="homeLabel" [href]="homeHref" icon="arrow-left" size="large" />
        </cx-stack>
      </main>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundComponent {
  protected readonly homeHref = languageBase(activeLanguage());
  protected readonly homeLabel = $localize`:@@notfound.home:Back to home`;
}
