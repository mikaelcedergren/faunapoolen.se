import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
} from '@angular/core';
import {
  CxMetricComponent,
  CxStackComponent,
  CxGridComponent,
  CxButtonComponent,
} from '@mikaelcedergren/cx-framework';
import { SitePage } from '../site-page';
import { SiteMeasurement } from '../site-measurement';

@Component({
  selector: 'fp-package-comparison',
  imports: [CxMetricComponent, CxStackComponent, CxGridComponent, CxButtonComponent],
  templateUrl: './package-comparison.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PackageComparisonComponent extends SitePage {
  protected readonly measurement = inject(SiteMeasurement);
  private readonly element = inject(ElementRef<HTMLElement>);
  private readonly destroy = inject(DestroyRef);
  protected readonly pricingLink = $localize`:@@site.packages.pricingLink:See prices and what is included`;
  constructor() {
    super();
    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting))
            this.measurement.track('package_comparison_view');
        },
        { threshold: 0.2 },
      );
      observer.observe(this.element.nativeElement);
      this.destroy.onDestroy(() => observer.disconnect());
    });
  }
}
