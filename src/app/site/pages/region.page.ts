import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  CxButtonComponent,
  CxGridComponent,
  CxHeroComponent,
  CxStackComponent,
  CxImageComponent,
  CxCardComponent,
} from '@mikaelcedergren/cx-framework';
import { FAUNAPOOLEN_COMMERCIAL } from '../content/faunapoolen-commercial';
import {
  FAUNAPOOLEN_REGIONS,
  REGION_COPY,
  type FaunapoolenRegionId,
} from '../content/faunapoolen-regions';
import { SitePage } from '../site-page';
import { SiteShellComponent } from '../site-shell.component';

@Component({
  selector: 'fp-region-page',
  imports: [
    CxButtonComponent,
    CxGridComponent,
    CxHeroComponent,
    CxStackComponent,
    SiteShellComponent,
    CxImageComponent,
    CxCardComponent,
  ],
  templateUrl: './region.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegionPage extends SitePage {
  protected readonly regional = REGION_COPY;
  protected readonly commercial = FAUNAPOOLEN_COMMERCIAL;
  protected readonly region = FAUNAPOOLEN_REGIONS[this.page as FaunapoolenRegionId];
}
