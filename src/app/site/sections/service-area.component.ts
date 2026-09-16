import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CxInlineComponent, CxStackComponent } from '@mikaelcedergren/cx-framework';
import { SitePage } from '../site-page';
import { FAUNAPOOLEN_COMMERCIAL } from '../content/faunapoolen-commercial';
import { FAUNAPOOLEN_REGIONS, type FaunapoolenRegionId } from '../content/faunapoolen-regions';

@Component({
  selector: 'fp-service-area',
  imports: [CxInlineComponent, CxStackComponent],
  templateUrl: './service-area.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceAreaComponent extends SitePage {
  protected readonly commercial = FAUNAPOOLEN_COMMERCIAL;
  protected readonly regions = (Object.keys(FAUNAPOOLEN_REGIONS) as FaunapoolenRegionId[]).map(
    (id) => ({ id, ...FAUNAPOOLEN_REGIONS[id] }),
  );
}
