import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'fp-not-found',
  template: `
    <section>
      <div class="section-content">
        <h1 i18n="@@notfound.h1">Sidan kunde inte hittas</h1>
        <p><a href="/" i18n="@@notfound.home">Till startsidan</a></p>
      </div>
    </section>
  `,
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundComponent {}
