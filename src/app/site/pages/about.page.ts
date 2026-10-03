import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  CxDividerComponent,
  CxGridComponent,
  CxHeroComponent,
  CxStackComponent,
} from '@mikaelcedergren/cx-framework';
import { FAUNAPOOLEN_COPY } from '../content/faunapoolen-content';
import { FAUNAPOOLEN_EVIDENCE_COPY } from '../content/faunapoolen-evidence';
import { GOTLAND_MEDIA } from '../content/faunapoolen-gotland';
import { FAUNAPOOLEN_TEAM } from '../content/faunapoolen-team';
import { CertificationStripComponent } from '../sections/certification-strip.component';
import { CertificationComponent } from '../sections/certification.component';
import { SitePage } from '../site-page';
import { SiteShellComponent } from '../site-shell.component';
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
  protected readonly evidence = FAUNAPOOLEN_EVIDENCE_COPY;
  protected readonly copy = FAUNAPOOLEN_COPY;

  protected readonly team = FAUNAPOOLEN_TEAM;
  protected readonly aboutHero = GOTLAND_MEDIA.filter((item) => item.kind === 'photo').find(
    (item) => item.id === '1423',
  )!;
}
