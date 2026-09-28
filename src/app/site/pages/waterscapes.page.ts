import {
  CxHeroComponent,
  CxImageComponent,
  CxCardComponent,
  CxStackComponent,
  CxGridComponent,
  CxButtonComponent,
} from '@mikaelcedergren/cx-framework';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SitePage } from '../site-page';
import { FAUNAPOOLEN_COMMERCIAL } from '../content/faunapoolen-commercial';
import { SiteShellComponent } from '../site-shell.component';
@Component({
  selector: 'fp-waterscapes-page',
  imports: [
    CxHeroComponent,
    CxStackComponent,
    CxGridComponent,
    CxButtonComponent,
    SiteShellComponent,
    CxImageComponent,
    CxCardComponent,
  ],
  templateUrl: './waterscapes.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WaterscapesPage extends SitePage {
  protected readonly commercial = FAUNAPOOLEN_COMMERCIAL;
}
