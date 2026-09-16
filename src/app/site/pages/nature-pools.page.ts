import { CxHeroComponent } from '@mikaelcedergren/cx-framework';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  CxStackComponent,
  CxGridComponent,
  CxButtonComponent,
} from '@mikaelcedergren/cx-framework';
import { SitePage } from '../site-page';
import { SiteShellComponent } from '../site-shell.component';
import { TechnologyComponent } from '../sections/technology.component';
import { PackageComparisonComponent } from '../sections/package-comparison.component';
@Component({
  selector: 'fp-nature-pools-page',
  imports: [
    CxHeroComponent,
    CxStackComponent,
    CxGridComponent,
    CxButtonComponent,
    SiteShellComponent,
    TechnologyComponent,
    PackageComparisonComponent,
  ],
  templateUrl: './nature-pools.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NaturePoolsPage extends SitePage {}
