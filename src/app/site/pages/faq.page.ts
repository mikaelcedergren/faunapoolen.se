import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  CxHeroComponent,
  CxListComponent,
  CxListItemComponent,
} from '@mikaelcedergren/cx-framework';
import { FAQ_ITEMS, FAQ_TITLE } from '../content/faunapoolen-faq';
import { SitePage } from '../site-page';
import { FAUNAPOOLEN_COMMERCIAL } from '../content/faunapoolen-commercial';
import { SiteShellComponent } from '../site-shell.component';

@Component({
  selector: 'fp-faq-page',
  imports: [CxHeroComponent, CxListComponent, CxListItemComponent, SiteShellComponent],
  templateUrl: './faq.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FaqPage extends SitePage {
  protected readonly commercial = FAUNAPOOLEN_COMMERCIAL;
  protected readonly title = FAQ_TITLE;
  protected readonly items = FAQ_ITEMS;
}
