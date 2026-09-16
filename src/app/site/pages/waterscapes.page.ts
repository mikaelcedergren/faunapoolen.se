import { CxHeroComponent } from '@mikaelcedergren/cx-framework';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  CxStackComponent,
  CxGridComponent,
  CxButtonComponent,
} from '@mikaelcedergren/cx-framework';
import { SitePage } from '../site-page';
import { SiteShellComponent } from '../site-shell.component';
@Component({
  selector: 'fp-waterscapes-page',
  imports: [
    CxHeroComponent,
    CxStackComponent,
    CxGridComponent,
    CxButtonComponent,
    SiteShellComponent,
  ],
  templateUrl: './waterscapes.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WaterscapesPage extends SitePage {}
