import {
  CxHeroComponent,
  CxImageComponent,
  CxStackComponent,
  CxGridComponent,
  CxButtonComponent,
} from '@mikaelcedergren/cx-framework';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SitePage } from '../site-page';
import { CertificationStripComponent } from '../sections/certification-strip.component';
import { WATERSCAPE_DETAILS } from '../content/faunapoolen-waterscapes';
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
  protected readonly waterTypes = this.copy.waterscapes.types.map((item, index) => ({
    ...item,
    ...WATERSCAPE_DETAILS[index],
  }));
}
