import {
  CxHeroComponent,
  CxStackComponent,
  CxGridComponent,
  CxDividerComponent,
} from '@mikaelcedergren/cx-framework';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SitePage } from '../site-page';
import { SiteShellComponent } from '../site-shell.component';
import { CertificationStripComponent } from '../sections/certification-strip.component';
import { FAUNAPOOLEN_TEAM } from '../content/faunapoolen-team';
import { GOTLAND_MEDIA } from '../content/faunapoolen-gotland';
import { CertificationComponent } from '../sections/certification.component';
@Component({
  selector: 'fp-about-page',
  imports: [
    CxHeroComponent,
    CxStackComponent,
    CxGridComponent,
    CxDividerComponent,
    SiteShellComponent,
    CertificationComponent,
    CertificationStripComponent,
  ],
  templateUrl: './about.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutPage extends SitePage {
  protected readonly team = FAUNAPOOLEN_TEAM;
  protected readonly aboutHero = GOTLAND_MEDIA.filter((item) => item.kind === 'photo').find(
    (item) => item.id === '1423',
  )!;
}
