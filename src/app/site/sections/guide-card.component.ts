import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CxCardComponent, CxStackComponent } from '@mikaelcedergren/cx-framework';
import { BlogArticle } from '../content/blog-catalog';

@Component({
  selector: 'fp-guide-card',
  imports: [CxCardComponent, CxStackComponent],
  styles: `
    :host {
      display: grid;
    }
  `,
  template: `
    <cx-card [href]="href()" [ariaLabel]="guide().title">
      <cx-stack gap="md" class="cx-p-md">
        <img
          class="fp-article-photo"
          [src]="guide().image"
          alt=""
          width="1536"
          height="1024"
          loading="lazy"
        />
        <h3 class="cx-text-title-2 cx-font-serif cx-font-regular">{{ guide().title }}</h3>
        <p class="cx-editorial cx-text-muted">{{ guide().summary }}</p>
      </cx-stack>
    </cx-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuideCardComponent {
  readonly guide = input.required<BlogArticle>();
  readonly href = input.required<string>();
}
