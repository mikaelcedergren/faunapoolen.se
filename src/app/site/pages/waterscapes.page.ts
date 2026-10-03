import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  CxButtonComponent,
  CxGridComponent,
  CxHeroComponent,
  CxImageComponent,
  CxStackComponent,
} from '@mikaelcedergren/cx-framework';
import { FAUNAPOOLEN_IMAGES } from '../content/faunapoolen-brand';
import { FAUNAPOOLEN_COPY } from '../content/faunapoolen-content';
import { FAUNAPOOLEN_EDITORIAL } from '../content/faunapoolen-editorial';
import { WATERSCAPE_DETAILS } from '../content/faunapoolen-waterscapes';
import { SITE_UI } from '../content/site-ui';
import { CertificationStripComponent } from '../sections/certification-strip.component';
import { SitePage } from '../site-page';
import { SiteShellComponent } from '../site-shell.component';
@Component({
  selector: 'fp-waterscapes-page',
  imports: [
    CxHeroComponent,
    CertificationStripComponent,
    CxStackComponent,
    CxGridComponent,
    CxButtonComponent,
    SiteShellComponent,
    CxImageComponent,
  ],
  templateUrl: './waterscapes.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WaterscapesPage extends SitePage {
  protected readonly images = FAUNAPOOLEN_IMAGES;
  protected readonly editorial = FAUNAPOOLEN_EDITORIAL;
  protected readonly ui = SITE_UI;
  protected readonly copy = FAUNAPOOLEN_COPY;

  protected readonly waterTypes = this.copy.waterscapes.types.map((item, index) => ({
    ...item,
    ...WATERSCAPE_DETAILS[index],
  }));
}
