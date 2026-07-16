import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  ViewEncapsulation,
  inject,
  signal,
} from '@angular/core';
import {
  CxAccountControlComponent,
  CxAlertComponent,
  CxButtonComponent,
  CxCardComponent,
  CxDividerComponent,
  CxIconButtonComponent,
  CxIconComponent,
  CxLabeledRowComponent,
  CxMarkdownComponent,
  CxPasswordFieldComponent,
  CxSideNavComponent,
  CxStackComponent,
  CxStatusTagComponent,
  CxTextFieldComponent,
  CxTopBarComponent,
  type CxFieldValidation,
  type CxLabeledRowContent,
  type CxSideNavGroup,
} from '@mikaelcedergren/cx-framework';

type AuthResponse = {
  authenticated?: boolean;
  error?: string;
  ok?: boolean;
};

type AdSuggestion = {
  headline: string;
  text: string;
  callToAction: string;
  whyItWorks: string;
};

type AdSource = {
  url: string;
  finalUrl: string;
  title: string;
  language: string;
};

type CopyLimits = {
  headline: number;
  text: number;
  callToAction: number;
  whyItWorks: number;
};

type AdBuilderResponse = {
  source?: AdSource;
  limits?: CopyLimits;
  ads?: AdSuggestion[];
  error?: string;
};

const DEFAULT_COPY_LIMITS: CopyLimits = {
  headline: 40,
  text: 180,
  callToAction: 24,
  whyItWorks: 320,
};

@Component({
  selector: 'fp-admin',
  imports: [
    CxAccountControlComponent,
    CxAlertComponent,
    CxButtonComponent,
    CxCardComponent,
    CxDividerComponent,
    CxIconButtonComponent,
    CxIconComponent,
    CxLabeledRowComponent,
    CxMarkdownComponent,
    CxPasswordFieldComponent,
    CxSideNavComponent,
    CxStackComponent,
    CxStatusTagComponent,
    CxTextFieldComponent,
    CxTopBarComponent,
  ],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminComponent implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly publicStylesheet = this.findPublicStylesheet();
  private readonly publicStylesheetMedia = this.originalPublicStylesheetMedia();
  private copyResetTimer?: ReturnType<typeof setTimeout>;

  @ViewChild('usernameField')
  private readonly usernameField?: CxTextFieldComponent;

  @ViewChild(CxPasswordFieldComponent)
  private readonly passwordField?: CxPasswordFieldComponent;

  @ViewChild('sourceUrlField')
  private readonly sourceUrlField?: CxTextFieldComponent;

  protected readonly authenticated = signal(false);
  protected readonly submitting = signal(false);
  protected readonly username = signal('');
  protected readonly password = signal('');
  protected readonly usernameValidation = signal<CxFieldValidation | undefined>(undefined);
  protected readonly passwordValidation = signal<CxFieldValidation | undefined>(undefined);
  protected readonly requestError = signal('');

  protected readonly sourceUrl = signal('');
  protected readonly sourceUrlValidation = signal<CxFieldValidation | undefined>(undefined);
  protected readonly generating = signal(false);
  protected readonly generationError = signal('');
  protected readonly ads = signal<AdSuggestion[]>([]);
  protected readonly source = signal<AdSource | undefined>(undefined);
  protected readonly limits = signal<CopyLimits>(DEFAULT_COPY_LIMITS);
  protected readonly copiedIndex = signal<number | undefined>(undefined);
  protected readonly mobileNavOpen = signal(false);

  protected readonly navGroups: CxSideNavGroup[] = [
    {
      id: 'tools',
      label: 'Tools',
      items: [
        {
          id: 'ad-builder',
          label: 'Ad builder',
          icon: 'text',
          routerLink: ['/admin'],
        },
      ],
    },
  ];

  public constructor() {
    this.document.documentElement.classList.add('theme-night');
    this.publicStylesheet?.setAttribute('media', 'not all');
  }

  public ngOnInit(): void {
    if (this.browser) {
      void this.restoreSession();
    }
  }

  public ngOnDestroy(): void {
    this.document.documentElement.classList.remove('theme-night');
    if (this.publicStylesheet) {
      if (this.publicStylesheetMedia === null) {
        this.publicStylesheet.removeAttribute('media');
      } else {
        this.publicStylesheet.setAttribute('media', this.publicStylesheetMedia);
      }
    }
    if (this.copyResetTimer) {
      clearTimeout(this.copyResetTimer);
    }
  }

  protected updateUsername(value: string): void {
    this.username.set(value);
    this.usernameValidation.set(undefined);
    this.requestError.set('');
  }

  protected updatePassword(value: string): void {
    this.password.set(value);
    this.passwordValidation.set(undefined);
    this.requestError.set('');
  }

  protected onFieldEnter(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      event.preventDefault();
      void this.signIn();
    }
  }

  protected async signIn(): Promise<void> {
    if (this.submitting()) {
      return;
    }

    const username = this.username().trim();
    const password = this.password();
    const usernameMissing = username.length === 0;
    const passwordMissing = password.length === 0;

    this.usernameValidation.set(usernameMissing ? 'Enter a username.' : undefined);
    this.passwordValidation.set(passwordMissing ? 'Enter a password.' : undefined);
    this.requestError.set('');

    if (usernameMissing || passwordMissing) {
      queueMicrotask(() =>
        usernameMissing ? this.usernameField?.focus() : this.passwordField?.focus(),
      );
      return;
    }

    this.submitting.set(true);
    try {
      const response = await this.post('/admin-auth/login', { username, password });
      if (!response.ok) {
        this.requestError.set(
          response.status === 401
            ? 'Username or password is incorrect. Try again.'
            : response.status === 429
              ? 'Too many sign-in attempts. Try again later.'
              : 'Admin login cannot be reached right now. Try again.',
        );
        return;
      }

      this.authenticated.set(true);
      this.password.set('');
      queueMicrotask(() => this.sourceUrlField?.focus());
    } catch {
      this.requestError.set('Admin login cannot be reached right now. Try again.');
    } finally {
      this.submitting.set(false);
    }
  }

  protected async signOut(): Promise<void> {
    if (this.submitting()) {
      return;
    }

    this.submitting.set(true);
    try {
      await this.post('/admin-auth/logout');
    } finally {
      this.authenticated.set(false);
      this.username.set('');
      this.password.set('');
      this.requestError.set('');
      this.resetAdBuilder();
      this.submitting.set(false);
      queueMicrotask(() => this.usernameField?.focus());
    }
  }

  protected updateSourceUrl(value: string): void {
    this.sourceUrl.set(value);
    this.sourceUrlValidation.set(undefined);
    this.generationError.set('');
  }

  protected onSourceUrlEnter(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      event.preventDefault();
      void this.generateAds();
    }
  }

  protected async generateAds(): Promise<void> {
    if (this.generating()) {
      return;
    }

    const url = this.normalizedSourceUrl(this.sourceUrl());
    if (!url) {
      this.sourceUrlValidation.set('Enter a valid web address.');
      queueMicrotask(() => this.sourceUrlField?.focus());
      return;
    }

    this.sourceUrl.set(url);
    this.sourceUrlValidation.set(undefined);
    this.generationError.set('');
    this.ads.set([]);
    this.source.set(undefined);
    this.copiedIndex.set(undefined);
    this.generating.set(true);

    try {
      const response = await this.post('/admin-auth/ad-builder', { url });
      const payload = (await response.json().catch(() => ({}))) as AdBuilderResponse;
      if (!response.ok) {
        if (response.status === 401) {
          this.authenticated.set(false);
          this.requestError.set('Your session expired. Sign in again.');
          return;
        }
        this.generationError.set(payload.error || this.generationErrorFor(response.status));
        return;
      }

      if (!payload.source || !payload.ads || payload.ads.length !== 5) {
        this.generationError.set('The suggestions came back incomplete. Try again.');
        return;
      }

      this.source.set(payload.source);
      this.limits.set(payload.limits ?? DEFAULT_COPY_LIMITS);
      this.ads.set(payload.ads);
    } catch {
      this.generationError.set('Ad builder cannot be reached right now. Try again.');
    } finally {
      this.generating.set(false);
    }
  }

  protected async copyAd(ad: AdSuggestion, index: number): Promise<void> {
    if (!this.browser) {
      return;
    }
    const copy = `${ad.headline}\n\n${ad.text}\n\n${ad.callToAction}`;
    try {
      await navigator.clipboard.writeText(copy);
      this.copiedIndex.set(index);
      if (this.copyResetTimer) {
        clearTimeout(this.copyResetTimer);
      }
      this.copyResetTimer = setTimeout(() => this.copiedIndex.set(undefined), 2_000);
    } catch {
      this.generationError.set('Copying failed. Select the text and copy it manually.');
    }
  }

  protected closeMobileNav(): void {
    this.mobileNavOpen.set(false);
  }

  protected toggleMobileNav(): void {
    this.mobileNavOpen.update(open => !open);
  }

  protected textRow(text: string): CxLabeledRowContent {
    return { kind: 'text', text };
  }

  protected fieldLabel(label: string, value: string, limit: number): string {
    return `${label} · ${value.length}/${limit}`;
  }

  protected whyItWorksMarkdown(value: string): string {
    return `> **Why this works**\n>\n> ${this.escapeMarkdown(value)}`;
  }

  protected sourceLabel(source: AdSource): string {
    try {
      return `${source.title} · ${new URL(source.finalUrl).hostname}`;
    } catch {
      return source.title;
    }
  }

  private async restoreSession(): Promise<void> {
    try {
      const response = await this.post('/admin-auth/session');
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as AuthResponse;
      this.authenticated.set(payload.authenticated === true);
      if (payload.authenticated) {
        queueMicrotask(() => this.sourceUrlField?.focus());
      }
    } catch {
      // The login form remains available when the development auth server is not running.
    }
  }

  private normalizedSourceUrl(value: string): string | undefined {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      const url = new URL(candidate);
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
        return undefined;
      }
      return url.href;
    } catch {
      return undefined;
    }
  }

  private generationErrorFor(status: number): string {
    if (status === 429) {
      return 'Ad builder is busy right now. Try again shortly.';
    }
    if (status === 503) {
      return 'OpenAI is not connected yet. Add the API key in .env and restart the server.';
    }
    return 'The ad could not be generated right now. Try again.';
  }

  private escapeMarkdown(value: string): string {
    return value.replace(/([\\`*_{}\[\]()<>#+.!|-])/g, '\\$1').replace(/\r?\n/g, ' ');
  }

  private findPublicStylesheet(): HTMLLinkElement | undefined {
    return Array.from(this.document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).find(
      link => link.getAttribute('href')?.startsWith('/assets/styles/styles.css'),
    );
  }

  private originalPublicStylesheetMedia(): string | null {
    const media = this.publicStylesheet?.getAttribute('media') ?? null;
    return media === 'not all' ? null : media;
  }

  private resetAdBuilder(): void {
    this.sourceUrl.set('');
    this.sourceUrlValidation.set(undefined);
    this.generationError.set('');
    this.generating.set(false);
    this.ads.set([]);
    this.source.set(undefined);
    this.limits.set(DEFAULT_COPY_LIMITS);
    this.copiedIndex.set(undefined);
    this.mobileNavOpen.set(false);
  }

  private post(path: string, body?: object): Promise<Response> {
    return fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  }
}
