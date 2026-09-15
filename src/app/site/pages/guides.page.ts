import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  CxStackComponent,
  CxGridComponent,
  CxCardComponent,
  CxImageComponent,
} from '@mikaelcedergren/cx-framework';
import { SitePage } from '../site-page';
import { SiteShellComponent } from '../site-shell.component';
@Component({
  selector: 'fp-guides-page',
  imports: [
    CxStackComponent,
    CxGridComponent,
    CxCardComponent,
    CxImageComponent,
    SiteShellComponent,
  ],
  templateUrl: './guides.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuidesPage extends SitePage {}
