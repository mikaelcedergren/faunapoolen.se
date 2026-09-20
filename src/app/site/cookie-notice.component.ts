import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  Injector,
  input,
  signal,
  viewChild,
} from '@angular/core';
import {
  CxButtonComponent,
  CxInlineComponent,
  CxPopoverComponent,
  CxStackComponent,
} from '@mikaelcedergren/cx-framework';
import { SiteMeasurement } from './site-measurement';

@Component({
  selector: 'fp-cookie-notice',
  imports: [CxButtonComponent, CxInlineComponent, CxPopoverComponent, CxStackComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a [href]="detailsHref()" (click)="openSettings($event)">{{ settings }}</a>
    @if (position(); as dock) {
      <cx-popover
        [open]="measurement.preference() === 'unset' || settingsOpen()"
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
          <p>{{ body }}</p>
          <cx-inline gap="sm" [wrap]="true">
            <cx-button [text]="reject" (click)="choose(false)" />
            <cx-button [text]="accept" (click)="choose(true)" />
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
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly popover = viewChild(CxPopoverComponent);
  protected readonly settingsOpen = signal(false);
  protected readonly opener = signal<HTMLElement | undefined>(undefined);
  protected readonly atTop = signal(false);
  protected readonly position = signal<{ gap: number; width: number } | undefined>(undefined);
  protected readonly settings = $localize`:@@site.measurement.settings:Cookie settings`;
  protected readonly body = $localize`:@@site.measurement.body:Allow Google Analytics cookies to understand visits and enquiries? Change your choice anytime.`;
  protected readonly reject = $localize`:@@site.measurement.decline:Reject`;
  protected readonly accept = $localize`:@@site.measurement.allow:Accept`;
  protected readonly details = $localize`:@@site.measurement.details:Cookie details`;

  constructor() {
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

  protected choose(allow: boolean): void {
    this.measurement.choose(allow ? 'allowed' : 'denied');
    this.settingsOpen.set(false);
  }

  protected dismiss(): void {
    if (this.measurement.preference() === 'unset') this.choose(false);
    else this.settingsOpen.set(false);
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
