import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CxStackComponent, CxCardComponent, CxTagComponent } from '@mikaelcedergren/cx-framework';
import { SitePage } from '../site-page';
import { SiteShellComponent } from '../site-shell.component';
import { ProcessComponent } from '../sections/process.component';
@Component({
  selector: 'fp-projects-page',
  imports: [
    CxStackComponent,
    CxCardComponent,
    CxTagComponent,
    SiteShellComponent,
    ProcessComponent,
  ],
  templateUrl: './projects.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsPage extends SitePage {}
