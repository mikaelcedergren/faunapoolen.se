import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  ViewEncapsulation,
  computed,
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
  CxPasswordFieldComponent,
  CxSideNavComponent,
  CxStackComponent,
  CxStatusTagComponent,
  CxTabsComponent,
  CxTagComponent,
  CxTextFieldComponent,
  CxTextAreaComponent,
  CxTopBarComponent,
  installCxKeyboardFocus,
  type CxFieldValidation,
  type CxSideNavGroup,
  type CxTabItem,
} from '@mikaelcedergren/cx-framework';

type AuthResponse = {
  authenticated?: boolean;
  error?: string;
  ok?: boolean;
};

type PlatformId = 'facebook' | 'instagram' | 'linkedin' | 'reels';
type ImageVariantId = 'feed' | 'vertical';

type StoryMap = {
  hero: string;
  externalProblem: string;
  internalProblem: string;
  guide: string;
  plan: string[];
  callToAction: string;
  failure: string;
  success: string;
};

type CoachNote = {
  principle: string;
  appliedText: string;
  explanation: string;
};

type PlatformAd = {
  id: PlatformId;
  placement: string;
  hook: string;
  body: string;
  callToAction: string;
  hashtags: string[];
  imageVariant: ImageVariantId;
  platformFit: string;
  coachNotes: CoachNote[];
};

type Campaign = {
  name: string;
  coreIdea: string;
  audience: string;
  desiredOutcome: string;
  singleMessage: string;
  assumptions: string[];
  story: StoryMap;
  visual: {
    concept: string;
    imagePrompt: string;
    altText: string;
  };
  platforms: PlatformAd[];
};

type CampaignVisual = {
  id: ImageVariantId;
  label: string;
  aspectRatio: string;
  mimeType: string;
  dataUrl: string;
  altText: string;
};

type AdBuilderResponse = {
  idea?: string;
  campaign?: Campaign;
  visuals?: CampaignVisual[];
  imageError?: string;
  error?: string;
};

type PlatformMeta = {
  label: string;
  bodyLabel: string;
  previewLabel: string;
};

type StoryLesson = {
  number: number;
  label: string;
  value: string;
};

const MAX_IDEA_CHARACTERS = 3_000;
const EXAMPLE_IDEA =
  'Jag vill berätta att en naturpool kan kännas som en del av trädgården, inte som en blå plastpool. Det ska kännas lugnt och möjligt att börja, även om man inte vet exakt vad man behöver.';
const GENERATION_MESSAGES = [
  'Finding the customer’s real goal…',
  'Building one clear StoryBrand story…',
  'Adapting the idea for each platform…',
  'Creating the feed and vertical visuals…',
] as const;

const PLATFORM_META: Record<PlatformId, PlatformMeta> = {
  facebook: {
    label: 'Facebook',
    bodyLabel: 'Primary text',
    previewLabel: 'Sponsored post',
  },
  instagram: {
    label: 'Instagram',
    bodyLabel: 'Caption',
    previewLabel: 'Sponsored post',
  },
  linkedin: {
    label: 'LinkedIn',
    bodyLabel: 'Introductory text',
    previewLabel: 'Promoted post',
  },
  reels: {
    label: 'Reels & TikTok',
    bodyLabel: '15–20 second script',
    previewLabel: 'Vertical short-form',
  },
};

const PLATFORM_TABS: CxTabItem[] = [
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'reels', label: 'Reels / TikTok' },
];

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
    CxPasswordFieldComponent,
    CxSideNavComponent,
    CxStackComponent,
    CxStatusTagComponent,
    CxTabsComponent,
    CxTagComponent,
    CxTextFieldComponent,
    CxTextAreaComponent,
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
  private readonly releaseKeyboardFocus = this.browser
    ? installCxKeyboardFocus(this.document)
    : () => {};
  private readonly publicStylesheet = this.findPublicStylesheet();
  private readonly publicStylesheetMedia = this.originalPublicStylesheetMedia();
  private copyResetTimer?: ReturnType<typeof setTimeout>;
  private downloadResetTimer?: ReturnType<typeof setTimeout>;
  private generationProgressTimer?: ReturnType<typeof setInterval>;

  @ViewChild('usernameField')
  private readonly usernameField?: CxTextFieldComponent;

  @ViewChild(CxPasswordFieldComponent)
  private readonly passwordField?: CxPasswordFieldComponent;

  @ViewChild('roughIdeaField')
  private readonly roughIdeaField?: CxTextAreaComponent;

  protected readonly authenticated = signal(false);
  protected readonly submitting = signal(false);
  protected readonly username = signal('');
  protected readonly password = signal('');
  protected readonly usernameValidation = signal<CxFieldValidation | undefined>(undefined);
  protected readonly passwordValidation = signal<CxFieldValidation | undefined>(undefined);
  protected readonly requestError = signal('');

  protected readonly roughIdea = signal('');
  protected readonly roughIdeaValidation = signal<CxFieldValidation | undefined>(undefined);
  protected readonly generating = signal(false);
  protected readonly generationStep = signal(0);
  protected readonly generationError = signal('');
  protected readonly campaign = signal<Campaign | undefined>(undefined);
  protected readonly visuals = signal<CampaignVisual[]>([]);
  protected readonly imageError = signal('');
  protected readonly selectedPlatformId = signal<PlatformId>('facebook');
  protected readonly copiedPlatformId = signal<PlatformId | undefined>(undefined);
  protected readonly downloadedVisualId = signal<ImageVariantId | undefined>(undefined);
  protected readonly mobileNavOpen = signal(false);

  protected readonly platformTabs = PLATFORM_TABS;
  protected readonly maxIdeaCharacters = MAX_IDEA_CHARACTERS;
  protected readonly generationMessage = computed(
    () => GENERATION_MESSAGES[this.generationStep()] ?? GENERATION_MESSAGES.at(-1)!,
  );
  protected readonly selectedPlatform = computed(() => {
    const campaign = this.campaign();
    if (!campaign) {
      return undefined;
    }
    return (
      campaign.platforms.find(platform => platform.id === this.selectedPlatformId()) ??
      campaign.platforms[0]
    );
  });
  protected readonly selectedPlatformMeta = computed(
    () => PLATFORM_META[this.selectedPlatform()?.id ?? this.selectedPlatformId()],
  );
  protected readonly selectedVisual = computed(() => {
    const visualId = this.selectedPlatform()?.imageVariant;
    return this.visuals().find(visual => visual.id === visualId);
  });
  protected readonly storyLessons = computed<StoryLesson[]>(() => {
    const story = this.campaign()?.story;
    if (!story) {
      return [];
    }
    return [
      { number: 1, label: 'Character', value: story.hero },
      {
        number: 2,
        label: 'Problem',
        value: `${story.externalProblem} ${story.internalProblem}`,
      },
      { number: 3, label: 'Guide', value: story.guide },
      { number: 4, label: 'Plan', value: story.plan.join(' → ') },
      { number: 5, label: 'Call to action', value: story.callToAction },
      { number: 6, label: 'Failure', value: story.failure },
      { number: 7, label: 'Success', value: story.success },
    ];
  });

  protected readonly navGroups: CxSideNavGroup[] = [
    {
      id: 'tools',
      label: 'Tools',
      items: [
        {
          id: 'campaign-studio',
          label: 'Campaign studio',
          icon: 'ai',
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
    this.releaseKeyboardFocus();
    this.document.documentElement.classList.remove('theme-night');
    if (this.publicStylesheet) {
      if (this.publicStylesheetMedia === null) {
        this.publicStylesheet.removeAttribute('media');
      } else {
        this.publicStylesheet.setAttribute('media', this.publicStylesheetMedia);
      }
    }
    this.clearTimers();
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
      queueMicrotask(() => this.roughIdeaField?.focus());
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
      this.resetCampaignStudio();
      this.submitting.set(false);
      queueMicrotask(() => this.usernameField?.focus());
    }
  }

  protected updateRoughIdea(value: string): void {
    this.roughIdea.set(value);
    this.roughIdeaValidation.set(undefined);
    this.generationError.set('');
  }

  protected useExampleIdea(): void {
    this.roughIdea.set(EXAMPLE_IDEA);
    this.roughIdeaValidation.set(undefined);
    this.generationError.set('');
    queueMicrotask(() => this.roughIdeaField?.focus());
  }

  protected async generateCampaign(): Promise<void> {
    if (this.generating()) {
      return;
    }

    const idea = this.roughIdea().trim();
    if (idea.length < 8) {
      this.roughIdeaValidation.set('Add a little more detail so the campaign has something to work with.');
      queueMicrotask(() => this.roughIdeaField?.focus());
      return;
    }

    this.roughIdeaValidation.set(undefined);
    this.generationError.set('');
    this.imageError.set('');
    this.copiedPlatformId.set(undefined);
    this.downloadedVisualId.set(undefined);
    this.generating.set(true);
    this.startGenerationProgress();

    try {
      const response = await this.post('/admin-auth/ad-builder', { idea });
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

      if (!payload.campaign || payload.campaign.platforms.length !== PLATFORM_TABS.length) {
        this.generationError.set('The campaign came back incomplete. Try again.');
        return;
      }

      this.campaign.set(payload.campaign);
      this.visuals.set(payload.visuals ?? []);
      this.imageError.set(payload.imageError ?? '');
      this.selectedPlatformId.set('facebook');
    } catch {
      this.generationError.set('Campaign studio cannot be reached right now. Try again.');
    } finally {
      this.stopGenerationProgress();
      this.generating.set(false);
    }
  }

  protected selectPlatform(id: string): void {
    if (this.isPlatformId(id)) {
      this.selectedPlatformId.set(id);
      this.copiedPlatformId.set(undefined);
      this.downloadedVisualId.set(undefined);
    }
  }

  protected async copySelectedAd(): Promise<void> {
    const platform = this.selectedPlatform();
    if (!this.browser || !platform) {
      return;
    }

    const sections = [platform.hook, platform.body];
    if (platform.hashtags.length > 0) {
      sections.push(platform.hashtags.join(' '));
    }
    sections.push(platform.callToAction);

    try {
      await navigator.clipboard.writeText(sections.join('\n\n'));
      this.copiedPlatformId.set(platform.id);
      if (this.copyResetTimer) {
        clearTimeout(this.copyResetTimer);
      }
      this.copyResetTimer = setTimeout(() => this.copiedPlatformId.set(undefined), 2_000);
    } catch {
      this.generationError.set('Copying failed. Select the text and copy it manually.');
    }
  }

  protected downloadSelectedImage(): void {
    const visual = this.selectedVisual();
    const campaign = this.campaign();
    if (!this.browser || !visual || !campaign) {
      return;
    }

    const link = this.document.createElement('a');
    link.href = visual.dataUrl;
    link.download = `faunapoolen-${this.slug(campaign.name)}-${visual.id}.webp`;
    link.hidden = true;
    this.document.body.append(link);
    link.click();
    link.remove();
    this.downloadedVisualId.set(visual.id);
    if (this.downloadResetTimer) {
      clearTimeout(this.downloadResetTimer);
    }
    this.downloadResetTimer = setTimeout(() => this.downloadedVisualId.set(undefined), 2_000);
  }

  protected newIdea(): void {
    this.roughIdea.set('');
    this.roughIdeaValidation.set(undefined);
    this.generationError.set('');
    this.imageError.set('');
    this.campaign.set(undefined);
    this.visuals.set([]);
    this.selectedPlatformId.set('facebook');
    this.copiedPlatformId.set(undefined);
    this.downloadedVisualId.set(undefined);
    queueMicrotask(() => this.roughIdeaField?.focus());
  }

  protected closeMobileNav(): void {
    this.mobileNavOpen.set(false);
  }

  protected toggleMobileNav(): void {
    this.mobileNavOpen.update(open => !open);
  }

  protected platformLabel(id: PlatformId): string {
    return PLATFORM_META[id].label;
  }

  protected hashtagLine(platform: PlatformAd): string {
    return platform.hashtags.join(' ');
  }

  protected copyButtonText(platform: PlatformAd): string {
    return this.copiedPlatformId() === platform.id ? 'Copied' : 'Copy ad';
  }

  protected downloadButtonText(visual: CampaignVisual | undefined): string {
    return visual && this.downloadedVisualId() === visual.id ? 'Downloaded' : 'Download image';
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
        queueMicrotask(() => this.roughIdeaField?.focus());
      }
    } catch {
      // The login form remains available when the development auth server is not running.
    }
  }

  private startGenerationProgress(): void {
    this.stopGenerationProgress();
    this.generationStep.set(0);
    this.generationProgressTimer = setInterval(() => {
      this.generationStep.update(step => Math.min(step + 1, GENERATION_MESSAGES.length - 1));
    }, 7_000);
  }

  private stopGenerationProgress(): void {
    if (this.generationProgressTimer) {
      clearInterval(this.generationProgressTimer);
      this.generationProgressTimer = undefined;
    }
  }

  private generationErrorFor(status: number): string {
    if (status === 429) {
      return 'Campaign studio is busy right now. Try again shortly.';
    }
    if (status === 503) {
      return 'OpenAI is not connected yet. Add the API key in .env and restart the server.';
    }
    if (status === 504) {
      return 'The campaign took too long to create. Try again.';
    }
    return 'The campaign could not be created right now. Try again.';
  }

  private isPlatformId(value: string): value is PlatformId {
    return value === 'facebook' || value === 'instagram' || value === 'linkedin' || value === 'reels';
  }

  private slug(value: string): string {
    return (
      value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 48) || 'campaign'
    );
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

  private resetCampaignStudio(): void {
    this.roughIdea.set('');
    this.roughIdeaValidation.set(undefined);
    this.generationError.set('');
    this.imageError.set('');
    this.generating.set(false);
    this.generationStep.set(0);
    this.campaign.set(undefined);
    this.visuals.set([]);
    this.selectedPlatformId.set('facebook');
    this.copiedPlatformId.set(undefined);
    this.downloadedVisualId.set(undefined);
    this.mobileNavOpen.set(false);
    this.clearTimers();
  }

  private clearTimers(): void {
    this.stopGenerationProgress();
    if (this.copyResetTimer) {
      clearTimeout(this.copyResetTimer);
      this.copyResetTimer = undefined;
    }
    if (this.downloadResetTimer) {
      clearTimeout(this.downloadResetTimer);
      this.downloadResetTimer = undefined;
    }
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
