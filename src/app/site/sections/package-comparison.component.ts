import {
  afterNextRender,
  Input,
  booleanAttribute,
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
  CxInlineComponent,
  CxIconComponent,
} from '@mikaelcedergren/cx-framework';
import { Router } from '@angular/router';
import type { FaunapoolenPackage } from '../content/faunapoolen-content';
import { NATURE_POOL_LANDING } from '../content/faunapoolen-landing';
import { FAUNAPOOLEN_COMMERCIAL } from '../content/faunapoolen-commercial';
import { SitePage } from '../site-page';
import { SiteMeasurement } from '../site-measurement';

@Component({
  selector: 'fp-package-comparison',
  imports: [
    CxMetricComponent,
    CxStackComponent,
    CxGridComponent,
    CxButtonComponent,
    CxInlineComponent,
    CxIconComponent,
  ],
  templateUrl: './package-comparison.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PackageComparisonComponent extends SitePage {
  @Input({ transform: booleanAttribute }) showPricingLink = true;
  @Input() enquiryAnchor?: string;
  @Input({ transform: booleanAttribute }) showDetails = false;
  private readonly router = inject(Router);
  protected readonly landing = NATURE_POOL_LANDING;
  protected readonly commercial = FAUNAPOOLEN_COMMERCIAL;
  protected interestHref(id: FaunapoolenPackage['id']): string {
    return this.enquiryAnchor
      ? this.routeFor(this.page) + '?package=' + id + '#' + this.enquiryAnchor
      : this.packageHref(id);
  }
  protected choosePackage(event: MouseEvent, id: FaunapoolenPackage['id']): void {
    this.measurement.track('package_interest', { packageId: id, service: 'pool' });
    if (
      !this.enquiryAnchor ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    )
      return;
    event.preventDefault();
    void this.router
      .navigate([], {
        queryParams: { package: id },
        queryParamsHandling: 'merge',
        fragment: this.enquiryAnchor,
      })
      .then(() => {
        const target = this.document.getElementById(this.enquiryAnchor!);
        target?.scrollIntoView({ block: 'start' });
        target?.querySelector<HTMLElement>('input')?.focus({ preventScroll: true });
      });
  }
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
