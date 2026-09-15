import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  CxStackComponent,
  CxDividerComponent,
  CxGridComponent,
  CxButtonComponent,
} from '@mikaelcedergren/cx-framework';
import { SitePage } from '../site-page';

@Component({
  selector: 'fp-package-comparison',
  imports: [CxStackComponent, CxDividerComponent, CxGridComponent, CxButtonComponent],
  templateUrl: './package-comparison.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PackageComparisonComponent extends SitePage {}
