import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  CxButtonComponent,
  CxGridComponent,
  CxHeroComponent,
  CxImageComponent,
  CxStackComponent,
} from '@mikaelcedergren/cx-framework';
import { FAUNAPOOLEN_COMMERCIAL } from '../content/faunapoolen-commercial';
import { FAUNAPOOLEN_COPY } from '../content/faunapoolen-content';
import { FAUNAPOOLEN_EVIDENCE_COPY } from '../content/faunapoolen-evidence';
import { GOTLAND_MEDIA } from '../content/faunapoolen-gotland';
import {
  FAUNAPOOLEN_REGIONS,
  REGION_COPY,
  type FaunapoolenRegionId,
} from '../content/faunapoolen-regions';
import { PublicPackageCatalogue } from '../package-catalogue';
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
  ],
  templateUrl: './region.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegionPage extends SitePage {
  protected readonly packageCatalogue = inject(PublicPackageCatalogue);
  protected readonly projectPhoto = GOTLAND_MEDIA.find((item) => item.kind === 'photo')!;
  protected readonly evidence = FAUNAPOOLEN_EVIDENCE_COPY;
  protected readonly copy = FAUNAPOOLEN_COPY;

  protected readonly regional = REGION_COPY;
  protected readonly commercial = FAUNAPOOLEN_COMMERCIAL;
  protected readonly region = FAUNAPOOLEN_REGIONS[this.page as FaunapoolenRegionId];
}
