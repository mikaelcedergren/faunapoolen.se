import { CxHeroComponent } from '@mikaelcedergren/cx-framework';
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
    CxHeroComponent,
    CxStackComponent,
    CxGridComponent,
    CxCardComponent,
    CxImageComponent,
    SiteShellComponent,
  ],
  templateUrl: './guides.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuidesPage extends SitePage {
  protected readonly pricingLink = $localize`:@@site.guides.pricingLink:Compare nature pool packages and prices`;
  protected readonly groups = [
    {
      title: $localize`:@@site.guides.planning:Planning your nature pool`,
      ids: [
        'build',
        'difference',
        'why-you-should-get-a-natural-pool',
        'hur-mycket-plats-behover-en-naturpool',
        '5-common-problems-installing-a-nature-pool',
        'pool-conversions',
        'naturpool-fran-forsta-samtal-till-bad',
        'naturpool-sakerhet-och-tillstand',
        'vad-kostar-det-att-aga-en-naturpool',
      ],
    },
    {
      title: $localize`:@@site.guides.care:How it works and how to care for it`,
      ids: [
        'how-filtering-works-with-nature-pools',
        'algae-control-and-maintenance-tips',
        'skotsel-av-naturpool-under-aret',
        'sports-stars-natural-ponds',
      ],
    },
    {
      title: $localize`:@@site.guides.garden:Water in the garden`,
      ids: [
        'creating-harmony-intergrating-water-features-with-your-landscape',
        'small-features-for-small-spaces',
        'can-i-use-water-storage-solutions-when-traditional-wells-arent-an-option',
        'how-faunapoolen-helps-golf-clubs-manage-ponds-lakes-and-streams',
      ],
    },
  ].map((group) => ({
    title: group.title,
    articles: group.ids.map((id) => this.guides.find((guide) => guide.id === id)!).filter(Boolean),
  }));
}
