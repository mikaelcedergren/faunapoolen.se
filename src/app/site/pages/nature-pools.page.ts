import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  CxStackComponent,
  CxGridComponent,
  CxInlineComponent,
  CxButtonComponent,
} from '@mikaelcedergren/cx-framework';
import { SitePage } from '../site-page';
import { SiteShellComponent } from '../site-shell.component';
import { TechnologyComponent } from '../sections/technology.component';
import { PackageComparisonComponent } from '../sections/package-comparison.component';
import { NetworkComponent } from '../sections/network.component';
@Component({
  selector: 'fp-nature-pools-page',
  imports: [
    CxStackComponent,
    CxGridComponent,
    CxInlineComponent,
    CxButtonComponent,
    SiteShellComponent,
    TechnologyComponent,
    PackageComparisonComponent,
    NetworkComponent,
  ],
  templateUrl: './nature-pools.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NaturePoolsPage extends SitePage {}
