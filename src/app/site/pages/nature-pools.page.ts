import { CxHeroComponent } from '@mikaelcedergren/cx-framework';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  CxStackComponent,
  CxGridComponent,
  CxButtonComponent,
} from '@mikaelcedergren/cx-framework';
import { ServiceAreaComponent } from '../sections/service-area.component';
import { ProcessComponent } from '../sections/process.component';
import { SitePage } from '../site-page';
import { FAUNAPOOLEN_COMMERCIAL } from '../content/faunapoolen-commercial';
import { SiteShellComponent } from '../site-shell.component';
import { TechnologyComponent } from '../sections/technology.component';
import { PackageComparisonComponent } from '../sections/package-comparison.component';
@Component({
  selector: 'fp-nature-pools-page',
  imports: [
    ProcessComponent,
    ServiceAreaComponent,
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
export class NaturePoolsPage extends SitePage {
  protected readonly commercial = FAUNAPOOLEN_COMMERCIAL;
}
