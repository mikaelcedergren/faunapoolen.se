import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CxGridComponent, CxHeroComponent, CxStackComponent } from '@mikaelcedergren/cx-framework';
import { BLOG_ARTICLES } from '../content/blog-catalog';
import { FAUNAPOOLEN_COPY } from '../content/faunapoolen-content';
import { CertificationStripComponent } from '../sections/certification-strip.component';
import { GuideCardComponent } from '../sections/guide-card.component';
import { SitePage } from '../site-page';
import { SiteShellComponent } from '../site-shell.component';
@Component({
  selector: 'fp-guides-page',
  imports: [
    GuideCardComponent,
    CxHeroComponent,
    CxStackComponent,
    CxGridComponent,
    SiteShellComponent,
    CertificationStripComponent,
  ],
  templateUrl: './guides.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuidesPage extends SitePage {
  protected readonly guides = BLOG_ARTICLES;
  protected readonly copy = FAUNAPOOLEN_COPY;
  protected readonly heroAlt = $localize`:@@site.guides.hero.alt:Dew-covered plants beside a garden pond at dusk, with warm lights reflected in the water.`;

  protected readonly groups = [
    {
      title: $localize`:@@site.guides.planning:Planning your nature pool`,
      ids: [
        'naturpool-10-vanliga-fragor',
        'naturpool-pris',
        'build',
        'difference',
        'why-you-should-get-a-natural-pool',
        'hur-mycket-plats-behover-en-naturpool',
        '5-common-problems-installing-a-nature-pool',
        'pool-conversions',
        'naturpool-fran-forsta-samtal-till-bad',
        'naturpool-sakerhet-och-tillstand',
        'vad-kostar-det-att-aga-en-naturpool',
        'varma-upp-naturpool',
        'sports-stars-natural-ponds',
        'naturpool-i-sodra-sverige',
      ],
    },
    {
      title: $localize`:@@site.guides.care:How it works and how to care for it`,
      ids: [
        'din-naturpool-skotsel-efter-installation',
        'how-filtering-works-with-nature-pools',
        'algae-control-and-maintenance-tips',
        'skotsel-av-naturpool-under-aret',
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
