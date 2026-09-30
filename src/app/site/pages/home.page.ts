import {
  CxCardComponent,
  CxGridComponent,
  CxButtonComponent,
  CxHeroComponent,
  CxInlineComponent,
} from '@mikaelcedergren/cx-framework';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SitePage } from '../site-page';
import { SiteShellComponent } from '../site-shell.component';
import { PackageComparisonComponent } from '../sections/package-comparison.component';
import { ProcessComponent } from '../sections/process.component';
@Component({
  selector: 'fp-home-page',
  imports: [
    CxCardComponent,
    CxGridComponent,
    CxHeroComponent,
    CxInlineComponent,
    CxButtonComponent,
    SiteShellComponent,
    PackageComparisonComponent,
    ProcessComponent,
  ],
  templateUrl: './home.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage extends SitePage {}
