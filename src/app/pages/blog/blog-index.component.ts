import { ChangeDetectionStrategy, Component, LOCALE_ID, inject } from '@angular/core';

@Component({
  selector: 'fp-blog-index',
  templateUrl: './blog-index.html',
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogIndexComponent {
  protected readonly en = inject(LOCALE_ID).toLowerCase().startsWith('en');
}
