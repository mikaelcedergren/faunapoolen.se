import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  HostListener,
  inject,
  Injector,
  input,
  signal,
  viewChild,
} from '@angular/core';
import {
  CxButtonComponent,
  CxCheckboxComponent,
  CxInlineComponent,
  CxPopoverComponent,
  CxStackComponent,
} from '@mikaelcedergren/cx-framework';
import { SiteMeasurement } from './site-measurement';
import { SiteMarketing } from './site-marketing';

@Component({
  selector: 'fp-cookie-notice',
  imports: [
    CxButtonComponent,
    CxCheckboxComponent,
    CxInlineComponent,
    CxPopoverComponent,
    CxStackComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .cookie-heading {
      color: var(--accent);
      font-size: var(--font-size-title-3);
    }
  `,
  template: `
    <a [href]="detailsHref()" (click)="openSettings($event)">{{ settings }}</a>
    @if (position(); as dock) {
      <cx-popover
        [open]="needsChoice() || settingsOpen()"
        [showBackdrop]="false"
        [owner]="opener()"
        role="region"
        [ariaLabel]="settings"
        surfaceId="cookie-notice"
        [left]="dock.gap"
        [bottom]="atTop() ? undefined : dock.gap"
        [top]="atTop() ? dock.gap : undefined"
        [width]="dock.width"
        (backdropPressed)="dismiss()"
      >
        <cx-stack class="cx-p-md" gap="md">
          <h2 class="cookie-heading">{{ title }}</h2>
          <p class="cx-text-body">{{ measurement.available() ? body : metaBody }}</p>
          @if (measurement.available()) {
            <cx-checkbox
              [text]="statistics"
              [hint]="statisticsHint"
              [selected]="statisticsSelected()"
              (selectedChange)="statisticsSelected.set($event)"
            />
          }
          @if (marketing.available()) {
            <cx-checkbox
              [text]="marketingLabel"
              [hint]="marketingHint"
              [selected]="marketingSelected()"
              (selectedChange)="marketingSelected.set($event)"
            />
          }
          <cx-inline gap="sm" [wrap]="true">
            <cx-button [text]="reject" (click)="choose(false)" />
            <cx-button [text]="accept" mood="accent" (click)="choose(true)" />
          </cx-inline>
        </cx-stack>
      </cx-popover>
    }
  `,
})
export class CookieNoticeComponent {
  readonly detailsHref = input.required<string>();
  protected readonly measurement = inject(SiteMeasurement);
  protected readonly marketing = inject(SiteMarketing);
  protected readonly statisticsSelected = signal(true);
  protected readonly marketingSelected = signal(true);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly popover = viewChild(CxPopoverComponent);
  protected readonly settingsOpen = signal(false);
  protected readonly opener = signal<HTMLElement | undefined>(undefined);
  protected readonly atTop = signal(false);
  protected readonly position = signal<{ gap: number; width: number } | undefined>(undefined);
  protected readonly settings = $localize`:@@site.measurement.settings:Cookie settings`;
  protected readonly title = $localize`:@@site.measurement.title:Cookies`;
  protected readonly metaBody = $localize`:@@site.measurement.metaBody:Allow marketing cookies to measure our ads and personalise advertising? Your website activity is shared with our advertising partner. Change your choice anytime.`;
  protected readonly body = $localize`:@@site.measurement.body:Optional cookies help us understand visits and enquiries and improve our marketing. Change your choices anytime.`;
  protected readonly reject = $localize`:@@site.measurement.decline:Reject`;
  protected readonly accept = $localize`:@@site.measurement.allow:Accept`;
  protected readonly statistics = $localize`:@@site.measurement.statistics:Statistics`;
  protected readonly statisticsHint = $localize`:@@site.measurement.statisticsHint:Google Analytics helps us understand visits and enquiries.`;
  protected readonly marketingLabel = $localize`:@@site.measurement.marketing:Marketing`;
  protected readonly marketingHint = $localize`:@@site.measurement.marketingHint:Measure ad results and personalise advertising using your visits and enquiries.`;

  constructor() {
    effect(() => {
      this.statisticsSelected.set(this.measurement.preference() !== 'denied');
      this.marketingSelected.set(this.marketing.preference() !== 'denied');
    });
    afterNextRender(() => {
      const root = this.document.documentElement;
      const updatePosition = () => {
        const style = this.document.defaultView!.getComputedStyle(root);
        const gap = parseFloat(style.getPropertyValue('--space-md'));
        // Dock within the usable page width, excluding a persistent browser scrollbar.
        const width = Math.max(
          0,
          Math.min(
            parseFloat(style.getPropertyValue('--content-width-sm')),
            root.clientWidth - gap * 2,
          ),
        );
        if (this.position()?.gap !== gap || this.position()?.width !== width)
          this.position.set({ gap, width });
      };
      updatePosition();
      const observer = new ResizeObserver(updatePosition);
      observer.observe(root);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  openSettings(event: Event): void {
    event.preventDefault();
    this.statisticsSelected.set(this.measurement.preference() !== 'denied');
    this.marketingSelected.set(this.marketing.preference() !== 'denied');
    this.opener.set(
      event.target instanceof HTMLElement
        ? (event.target.closest<HTMLElement>('button, a') ?? event.target)
        : undefined,
    );
    this.atTop.set(false);
    this.settingsOpen.set(true);
    afterNextRender(
      () =>
        this.popover()
          ?.surfaceElement()
          ?.querySelector<HTMLButtonElement>('button')
          ?.focus({ preventScroll: true }),
      { injector: this.injector },
    );
  }

  protected needsChoice(): boolean {
    return (
      (this.measurement.available() && this.measurement.preference() === 'unset') ||
      (this.marketing.available() && this.marketing.preference() === 'unset')
    );
  }

  protected choose(allow: boolean): void {
    const statistics = allow && this.measurement.available() && this.statisticsSelected();
    const marketing = allow && this.marketing.available() && this.marketingSelected();
    this.measurement.choose(statistics ? 'allowed' : 'denied');
    this.marketing.choose(marketing ? 'allowed' : 'denied');
    this.settingsOpen.set(false);
  }

  protected dismiss(): void {
    if (this.measurement.preference() === 'unset') this.measurement.choose('denied');
    if (this.marketing.preference() === 'unset') this.marketing.choose('denied');
    this.settingsOpen.set(false);
  }

  // Keep the non-modal notice out of the way of keyboard and form interaction.
  @HostListener('document:focusin', ['$event'])
  protected avoidFocusedControl(event: FocusEvent): void {
    const surface = this.popover()?.surfaceElement();
    const target = event.target;
    if (!surface || !(target instanceof HTMLElement) || surface.contains(target)) return;
    const control = target.getBoundingClientRect();
    const notice = surface.getBoundingClientRect();
    if (
      control.left < notice.right &&
      control.right > notice.left &&
      control.top < notice.bottom &&
      control.bottom > notice.top
    ) {
      this.atTop.set(control.top > this.document.documentElement.clientHeight / 2);
    }
  }
}
