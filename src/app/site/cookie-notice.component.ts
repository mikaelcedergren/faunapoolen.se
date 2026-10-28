import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
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
          <p class="cx-editorial">{{ body }}</p>
          @if (settingsOpen() && measurement.available()) {
            <cx-checkbox
              [text]="statistics"
              [hint]="statisticsHint"
              [selected]="statisticsSelected()"
              (selectedChange)="statisticsSelected.set($event)"
            />
          }
          @if (settingsOpen() && marketing.available()) {
            <cx-checkbox
              [text]="marketingLabel"
              [hint]="marketingHint"
              [selected]="marketingSelected()"
              (selectedChange)="marketingSelected.set($event)"
            />
          }
          <cx-inline gap="sm" [wrap]="true">
            <cx-button [text]="reject" (click)="choose(false)" />
            <cx-button [text]="accept" (click)="choose(true)" />
          </cx-inline>
          <cx-inline gap="sm" [wrap]="true">
            @if (settingsOpen()) {
              <cx-button [text]="save" (click)="saveChoices()" />
            } @else {
              <cx-button [text]="customize" (click)="showChoices()" />
            }
            <a [href]="detailsHref()">{{ details }}</a>
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
  protected readonly statisticsSelected = signal(false);
  protected readonly marketingSelected = signal(false);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly popover = viewChild(CxPopoverComponent);
  protected readonly settingsOpen = signal(false);
  protected readonly opener = signal<HTMLElement | undefined>(undefined);
  protected readonly atTop = signal(false);
  protected readonly position = signal<{ gap: number; width: number } | undefined>(undefined);
  protected readonly settings = $localize`:@@site.measurement.settings:Cookie settings`;
  protected readonly body = $localize`:@@site.measurement.body:Optional cookies help us understand visits and enquiries and let Meta measure and personalise advertising. Change your choices anytime.`;
  protected readonly reject = $localize`:@@site.measurement.decline:Reject all`;
  protected readonly accept = $localize`:@@site.measurement.allow:Accept all`;
  protected readonly save = $localize`:@@site.measurement.save:Save choices`;
  protected readonly customize = $localize`:@@site.measurement.customize:Choose cookies`;
  protected readonly statistics = $localize`:@@site.measurement.statistics:Statistics`;
  protected readonly statisticsHint = $localize`:@@site.measurement.statisticsHint:Google Analytics helps us understand visits and enquiries.`;
  protected readonly marketingLabel = $localize`:@@site.measurement.marketing:Marketing`;
  protected readonly marketingHint = $localize`:@@site.measurement.marketingHint:Meta measures ad results and personalises advertising using your visits and enquiries.`;
  protected readonly details = $localize`:@@site.measurement.details:Cookie details`;

  constructor() {
    effect(() => {
      this.statisticsSelected.set(this.measurement.preference() === 'allowed');
      this.marketingSelected.set(this.marketing.preference() === 'allowed');
    });
    afterNextRender(() => {
      const style = this.document.defaultView!.getComputedStyle(this.document.documentElement);
      this.position.set({
        gap: parseFloat(style.getPropertyValue('--space-md')),
        width: parseFloat(style.getPropertyValue('--measure-sm')),
      });
    });
  }

  openSettings(event: Event): void {
    event.preventDefault();
    this.statisticsSelected.set(this.measurement.preference() === 'allowed');
    this.marketingSelected.set(this.marketing.preference() === 'allowed');
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

  protected showChoices(): void {
    this.settingsOpen.set(true);
    afterNextRender(
      () => this.popover()?.surfaceElement()?.querySelector<HTMLInputElement>('input')?.focus(),
      { injector: this.injector },
    );
  }

  protected saveChoices(): void {
    this.measurement.choose(this.statisticsSelected() ? 'allowed' : 'denied');
    this.marketing.choose(this.marketingSelected() ? 'allowed' : 'denied');
    this.settingsOpen.set(false);
  }

  protected choose(allow: boolean): void {
    this.measurement.choose(allow ? 'allowed' : 'denied');
    this.marketing.choose(allow ? 'allowed' : 'denied');
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
