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
  CxDialogComponent,
  CxDividerComponent,
  CxExpansionPanelComponent,
  CxIconButtonComponent,
  CxIconComponent,
  CxInlineComponent,
  CxItemCardComponent,
  CxLabeledRowComponent,
  CxPasswordFieldComponent,
  CxSideNavComponent,
  CxStackComponent,
  CxStateMessageComponent,
  CxStepsComponent,
  CxTableComponent,
  CxTabsComponent,
  CxTagFieldComponent,
  CxTextFieldComponent,
  CxTextAreaComponent,
  CxTopBarComponent,
  type CxFieldValidation,
  type CxLabeledRowContent,
  type CxMenuItem,
  type CxSideNavGroup,
  type CxStateMessageAction,
  type CxStep,
  type CxTabItem,
  type CxTableColumn,
  type CxTableRow,
  type CxTableRowActivateEvent,
  type CxTableRowMenuSelectEvent,
  type CxThemeMode,
  CX_THEMES,
  CX_THEME_ICONS,
  CX_THEME_LABELS,
  cxThemeStartsGroup,
  isCxThemeMode,
} from '@mikaelcedergren/cx-framework';

type AuthResponse = { authenticated?: boolean; ok?: boolean };

type Language = 'sv' | 'en';
type EditableTextField =
  | 'headline'
  | 'description'
  | 'primaryText'
  | 'fullCaption'
  | 'callToAction';
type CampaignStage = 'strategy' | 'copy' | 'complete';
type GenerationStep = 'strategy' | 'copy' | 'prompts';
type StepStatus = 'waiting' | 'active' | 'done' | 'failed';
type View = 'list' | 'campaign';

type CopyFieldConfig = {
  id: string;
  label: string;
  budget: number;
  reason: string;
  guidance: string;
  multiline: boolean;
};

type MarketingRule = { id: string; name: string; teaches: string };

type Rationale = { field?: string; topic?: string; ruleIds: string[]; why?: string; guidance?: string };

type LanguageCopy = {
  headline: string;
  description: string;
  primaryText: string;
  fullCaption: string;
  callToAction: string;
  hashtags: string[];
  variations: { headline: string[]; primaryText: string[] };
  rationale: Rationale[];
};

type Strategy = {
  name: string;
  audience: string;
  desiredOutcome: string;
  singleMessage: string;
  externalProblem: string;
  internalProblem: string;
  plan: string[];
  assumptions: string[];
  rationale: Rationale[];
};

type ImagePrompt = {
  concept: string;
  label: string;
  prompt: string;
  altText: string;
  ruleIds: string[];
  why: string;
};

type Campaign = {
  id: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  idea: string;
  name: string;
  stage: CampaignStage;
  strategy: Strategy;
  copy: Partial<Record<Language, LanguageCopy>>;
  imagePrompts: ImagePrompt[];
};

type CampaignSummary = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  stage: CampaignStage;
};

type ConfigResponse = {
  fields?: CopyFieldConfig[];
  rules?: MarketingRule[];
  maxIdeaCharacters?: number;
  limitsVerifiedOn?: string;
};

type CampaignResponse = { campaign?: Campaign };

type ApiError = {
  error?: {
    code?: string;
    message?: string;
    details?: { currentRevision?: number };
  };
};

type GenerationState = 'queued' | 'running' | 'succeeded' | 'failed' | 'ambiguous';

type GenerationAcceptance = {
  campaignRevision: number;
  campaignId: string;
  jobId: string;
  state: 'queued';
};

type GenerationStatus = {
  campaignRevision: number;
  campaignId: string;
  jobId: string;
  stage: GenerationStep;
  state: GenerationState;
  updatedAt: string;
  error?: { code: string; message: string };
};

type RecoverableGenerationsResponse = { generations?: GenerationStatus[] };

/** A copy field resolved for the selected language, ready to render as an editable control. */
type ResolvedField = CopyFieldConfig & {
  value: string;
  tags: string[];
  used: number;
  hint: string;
  validation: CxFieldValidation | undefined;
};

type LabeledRow = { label: string; content: CxLabeledRowContent };

type PromptSection = { concept: string; label: string; code: string; altText: string };

const DEFAULT_THEME: CxThemeMode = 'night';
const THEME_STORAGE_KEY = 'fp-admin-theme';
const FALLBACK_MAX_IDEA_CHARACTERS = 3_000;
const MIN_IDEA_CHARACTERS = 8;

const EXAMPLE_IDEA =
  'Jag vill berätta att en naturpool kan kännas som en del av trädgården, inte som en blå plastpool. Det ska kännas lugnt och möjligt att börja, även om man inte vet exakt vad man behöver.';

// English is the default: the owner reads English, and the Swedish copy is checked afterwards.
const DEFAULT_LANGUAGE: Language = 'en';
const LANGUAGE_TABS: CxTabItem[] = [
  { id: 'en', label: 'English' },
  { id: 'sv', label: 'Svenska' },
];

const CAMPAIGN_COLUMNS: CxTableColumn[] = [
  // State first, entity second, time last — the reading order answers what is ready, which
  // campaign, and when it was made.
  { id: 'status', label: 'Status', size: 'content', hideable: false, pinnable: false },
  { id: 'name', label: 'Campaign', key: true, size: 'flex', hideable: false, pinnable: false },
  {
    id: 'created',
    label: 'Created',
    size: 'content',
    align: 'end',
    hideable: false,
    pinnable: false,
  },
];

const STRATEGY_TOPIC_LABELS: Record<string, string> = {
  audience: 'Why this audience',
  desiredOutcome: 'Why this outcome',
  singleMessage: 'Why this single message',
  problem: 'Why this problem',
  plan: 'Why these three steps',
};

const DELETE_MENU: CxMenuItem[] = [
  { id: 'delete', label: 'Delete campaign', prependIcon: 'delete', danger: true },
];

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

@Component({
  selector: 'fp-admin',
  imports: [
    CxAccountControlComponent,
    CxAlertComponent,
    CxButtonComponent,
    CxCardComponent,
    CxDialogComponent,
    CxDividerComponent,
    CxExpansionPanelComponent,
    CxIconButtonComponent,
    CxIconComponent,
    CxInlineComponent,
    CxItemCardComponent,
    CxLabeledRowComponent,
    CxPasswordFieldComponent,
    CxSideNavComponent,
    CxStackComponent,
    CxStateMessageComponent,
    CxStepsComponent,
    CxTableComponent,
    CxTabsComponent,
    CxTagFieldComponent,
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
  private readonly publicStylesheet = this.findPublicStylesheet();
  private readonly publicStylesheetMedia = this.originalPublicStylesheetMedia();
  private copyResetTimer?: ReturnType<typeof setTimeout>;
  private generationPollSequence = 0;
  private copySaveQueue: Promise<void> = Promise.resolve();

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

  protected readonly view = signal<View>('list');
  protected readonly campaigns = signal<CampaignSummary[]>([]);
  protected readonly campaign = signal<Campaign | undefined>(undefined);
  protected readonly fields = signal<CopyFieldConfig[]>([]);
  protected readonly rules = signal<MarketingRule[]>([]);
  protected readonly maxIdeaCharacters = signal(FALLBACK_MAX_IDEA_CHARACTERS);

  protected readonly roughIdea = signal('');
  protected readonly roughIdeaValidation = signal<CxFieldValidation | undefined>(undefined);
  protected readonly generating = signal(false);
  protected readonly stepStatus = signal<Record<GenerationStep, StepStatus>>(idleSteps());
  protected readonly generationError = signal('');
  protected readonly copyError = signal('');
  protected readonly generationCampaignId = signal('');
  protected readonly generationRevision = signal(0);
  protected readonly retryStage = signal<GenerationStep | undefined>(undefined);
  protected readonly language = signal<Language>(DEFAULT_LANGUAGE);
  protected readonly copiedId = signal('');
  protected readonly pendingDelete = signal<CampaignSummary | undefined>(undefined);
  protected readonly mobileNavOpen = signal(false);
  protected readonly composeOpen = signal(false);

  protected readonly languageTabs = LANGUAGE_TABS;
  protected readonly deleteMenu = DELETE_MENU;
  protected readonly newCampaignAction: CxStateMessageAction = {
    text: 'Create campaign',
    mood: 'primary',
    icon: 'new',
  };
  protected readonly writeCopyAction: CxStateMessageAction = {
    text: 'Write the campaign copy',
    mood: 'primary',
    icon: 'bolt',
  };
  protected readonly writePromptsAction: CxStateMessageAction = {
    text: 'Write the image prompts',
    mood: 'primary',
    icon: 'bolt',
  };

  private readonly ruleIndex = computed(() => new Map(this.rules().map(rule => [rule.id, rule])));

  // The sequence is fixed and each position is only reported once the server has actually returned
  // that stage, so the indicator never claims progress the studio has not made.
  protected readonly generationSteps = computed<CxStep[]>(() => {
    const status = this.stepStatus();
    return [
      { name: 'Strategy', mood: status.strategy === 'failed' ? 'danger' : 'default' },
      { name: 'Campaign copy', mood: status.copy === 'failed' ? 'danger' : 'default' },
      { name: 'Image prompts', mood: status.prompts === 'failed' ? 'danger' : 'default' },
    ];
  });

  protected readonly generationIndex = computed(() => {
    const status = this.stepStatus();
    return (['strategy', 'copy', 'prompts'] as const).filter(step => status[step] === 'done').length;
  });

  protected readonly incomplete = computed(() => {
    const current = this.campaign();
    return this.generating() || (current !== undefined && current.stage !== 'complete');
  });

  protected readonly activeCopy = computed(() => this.campaign()?.copy[this.language()]);

  protected readonly resolvedFields = computed<ResolvedField[]>(() => {
    const copy = this.activeCopy();
    if (!copy) {
      return [];
    }
    const guidance = new Map(
      copy.rationale
        .filter(entry => entry.field)
        .map(entry => [entry.field as string, entry.guidance ?? '']),
    );
    return this.fields().map(field => {
      const tags = field.id === 'hashtags' ? copy.hashtags : [];
      const value =
        field.id === 'hashtags' ? tags.join(' ') : String(copy[fieldKey(field.id)] ?? '');
      // Hashtags are budgeted per tag, so the count reports the longest one rather than the line.
      const used =
        field.id === 'hashtags' ? Math.max(0, ...tags.map(characterCount)) : characterCount(value);
      return {
        ...field,
        value,
        tags,
        used,
        // The count rides the guidance line instead of getting a meter of its own.
        hint: `${guidance.get(field.id) || field.guidance} · ${used}/${field.budget}`,
        // The field swaps the hint for validation, so advice and correction never stack up.
        validation: used > field.budget
          ? `${used} characters. This campaign is written to ${field.budget}.`
          : undefined,
      };
    });
  });

  protected readonly campaignColumns = CAMPAIGN_COLUMNS;

  protected readonly campaignRows = computed<CxTableRow[]>(() =>
    this.campaigns().map(item => ({
      id: item.id,
      cells: {
        status: {
          kind: 'status-tag',
          mood: item.stage === 'complete' ? 'success' : 'warning',
          icon: item.stage === 'complete' ? 'check' : 'in-progress',
          text: this.stageLabel(item.stage),
        },
        name: { kind: 'text', value: item.name, strong: true },
        created: { kind: 'text', value: this.campaignDate(item.createdAt), muted: true },
      },
      menuItems: DELETE_MENU,
    })),
  );

  protected readonly variationField = signal<'headline' | 'primaryText'>('headline');

  protected readonly variationHeading = computed(() => {
    const id = this.variationField();
    const label = this.fields().find(field => field.id === id)?.label ?? id;
    return `Three other angles for ${label.toLowerCase()}`;
  });

  /** The tag field needs the available set as well as the selected ids. */
  protected readonly hashtagTags = computed(() =>
    (this.activeCopy()?.hashtags ?? []).map(tag => ({ id: tag, name: tag })),
  );

  protected readonly variations = computed<string[]>(
    () => this.activeCopy()?.variations[this.variationField()] ?? [],
  );

  /** The rules behind the campaign, surfaced once instead of repeating under every field. */
  protected readonly rulesAppliedRow = computed<CxLabeledRowContent>(() => {
    const ids = new Set((this.activeCopy()?.rationale ?? []).flatMap(entry => entry.ruleIds));
    const names = this.rulesFor([...ids]).map(rule => rule.name);
    return { kind: 'text', text: names.length > 0 ? names.join(' · ') : 'None' };
  });

  protected readonly strategyRows = computed<LabeledRow[]>(() => {
    const strategy = this.campaign()?.strategy;
    if (!strategy) {
      return [];
    }
    return [
      { label: 'Customer', content: { kind: 'text', text: strategy.audience } },
      { label: 'Desired outcome', content: { kind: 'text', text: strategy.desiredOutcome } },
      {
        label: 'Problem',
        content: {
          kind: 'text',
          text: `${strategy.externalProblem} ${strategy.internalProblem}`,
        },
      },
      { label: 'The three steps', content: { kind: 'text', text: strategy.plan.join(' → ') } },
    ];
  });

  protected readonly assumptionRows = computed<LabeledRow[]>(() =>
    (this.campaign()?.strategy.assumptions ?? []).map((assumption, index) => ({
      label: index === 0 ? 'Check before publishing' : '',
      content: { kind: 'text', text: assumption },
    })),
  );

  protected readonly strategyWhyRows = computed<LabeledRow[]>(() =>
    (this.campaign()?.strategy.rationale ?? []).map(entry => ({
      label: STRATEGY_TOPIC_LABELS[entry.topic ?? ''] ?? 'Why this decision',
      content: { kind: 'text', text: entry.why ?? '' },
    })),
  );

  // Composed once per campaign so the template never rebuilds labeled-row content objects on
  // every change-detection pass.
  protected readonly promptSections = computed<PromptSection[]>(() =>
    (this.campaign()?.imagePrompts ?? []).map(prompt => ({
      concept: prompt.concept,
      label: prompt.label,
      code: prompt.prompt,
      altText: prompt.altText,
    })),
  );

  protected readonly topBarHeading = computed(() => {
    switch (this.view()) {
      case 'campaign':
        return this.campaign()?.name ?? 'Campaign';
      default:
        return 'Campaigns';
    }
  });

  protected readonly topBarDescription = computed(() => {
    switch (this.view()) {
      case 'campaign':
        return this.campaign()?.strategy.singleMessage ?? '';
      default:
        return 'One rough idea becomes one campaign, written to fit every feed it runs in.';
    }
  });

  protected readonly theme = signal<CxThemeMode>(DEFAULT_THEME);

  /**
   * The account menu owns identity-level choices. Supplying menuItems replaces the component's
   * default set, so log out is declared here too — the component still routes its own id to the
   * logout output.
   */
  protected readonly accountMenu = computed<CxMenuItem[]>(() => {
    const current = this.theme();
    return [
      {
        id: 'theme',
        label: 'Theme',
        prependIcon: CX_THEME_ICONS[current],
        selection: 'single',
        items: CX_THEMES.map((definition, index) => ({
          id: `theme:${definition.id}`,
          label: CX_THEME_LABELS[definition.id],
          prependIcon: CX_THEME_ICONS[definition.id],
          type: 'choice' as const,
          selected: definition.id === current,
          dividerBefore: cxThemeStartsGroup(index),
        })),
      },
      { id: 'logout', label: 'Log out', prependIcon: 'log-out', danger: true, dividerBefore: true },
    ];
  });

  protected readonly navGroups: CxSideNavGroup[] = [
    {
      id: 'tools',
      label: 'Tools',
      items: [
        { id: 'campaigns', label: 'Campaigns', icon: 'send', routerLink: ['/admin'] },
      ],
    },
  ];

  public constructor() {
    // The admin screens are a cx-framework surface inside a site whose public stylesheet is global.
    // Suppressing that one link keeps the public-site cascade off /admin without touching either
    // stylesheet; both are restored when the route is left.
    this.applyTheme(this.theme());
    this.publicStylesheet?.setAttribute('media', 'not all');
  }

  public ngOnInit(): void {
    if (this.browser) {
      this.restoreTheme();
      void this.restoreSession();
    }
  }

  public ngOnDestroy(): void {
    this.generationPollSequence += 1;
    this.document.documentElement.classList.remove(`theme-${this.theme()}`);
    if (this.publicStylesheet) {
      if (this.publicStylesheetMedia === null) {
        this.publicStylesheet.removeAttribute('media');
      } else {
        this.publicStylesheet.setAttribute('media', this.publicStylesheetMedia);
      }
    }
    this.clearCopyTimer();
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

  protected onSubmit(event: Event): void {
    event.preventDefault();
    void this.signIn();
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
      const response = await this.request('/api/admin/login', {
        method: 'POST',
        body: { username, password },
      });
      if (!response.ok) {
        // Unexpected refusals (an origin guard, a proxy problem) surface the server's own words
        // so the real cause is readable instead of hiding behind a generic connection message.
        this.requestError.set(
          response.status === 401
            ? 'Username or password is incorrect. Try again.'
            : response.status === 429
              ? 'Too many sign-in attempts. Try again later.'
              : await this.apiErrorMessage(
                  response,
                  'Admin login cannot be reached right now. Try again.',
                ),
        );
        return;
      }

      this.authenticated.set(true);
      this.password.set('');
      await this.loadWorkspace();
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
      await this.request('/api/admin/logout', { method: 'POST' });
    } finally {
      this.generationPollSequence += 1;
      this.authenticated.set(false);
      this.username.set('');
      this.password.set('');
      this.requestError.set('');
      this.resetStudio();
      this.submitting.set(false);
      queueMicrotask(() => this.usernameField?.focus());
    }
  }

  protected startNewCampaign(): void {
    this.roughIdea.set('');
    this.roughIdeaValidation.set(undefined);
    this.generationError.set('');
    this.composeOpen.set(true);
    queueMicrotask(() => this.roughIdeaField?.focus());
  }

  protected closeCompose(): void {
    this.composeOpen.set(false);
    this.generationError.set('');
  }

  protected showCampaigns(): void {
    this.view.set('list');
    this.campaign.set(undefined);
    this.generationError.set('');
    this.copyError.set('');
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

  /** The server owns the durable three-stage pipeline; this request only accepts the work. */
  protected async createCampaign(): Promise<void> {
    if (this.generating()) {
      return;
    }

    const idea = this.roughIdea().trim();
    if (idea.length < MIN_IDEA_CHARACTERS) {
      this.roughIdeaValidation.set(
        'Add a little more detail so the campaign has something to work with.',
      );
      queueMicrotask(() => this.roughIdeaField?.focus());
      return;
    }

    this.generationError.set('');
    this.copyError.set('');
    this.generating.set(true);
    this.stepStatus.set({ strategy: 'active', copy: 'waiting', prompts: 'waiting' });

    try {
      const response = await this.request('/api/admin/campaigns', {
        method: 'POST',
        body: { idea },
      });
      if (!response.ok) {
        await this.handleGenerationFailure(response, 'strategy', false);
        this.generating.set(false);
        return;
      }
      const payload = (await response.json()) as { generation?: GenerationAcceptance };
      if (!payload.generation) {
        this.generationError.set('The campaign was not accepted. Try again.');
        this.setStep('strategy', 'failed');
        this.generating.set(false);
        return;
      }
      this.composeOpen.set(false);
      this.view.set('campaign');
      this.followGeneration(payload.generation);
    } catch {
      this.generationError.set('Campaigns cannot be reached right now. Try again.');
      this.setStep('strategy', 'failed');
      this.generating.set(false);
    }
  }

  protected async writeCopy(): Promise<void> {
    await this.startTargetedGeneration('copy');
  }

  protected async writeImagePrompts(): Promise<void> {
    await this.startTargetedGeneration('prompts');
  }

  protected async retryGeneration(): Promise<void> {
    const stage = this.retryStage();
    if (stage) await this.startTargetedGeneration(stage);
  }

  private async startTargetedGeneration(stage: GenerationStep): Promise<void> {
    const campaignId = this.campaign()?.id || this.generationCampaignId();
    const expectedRevision = this.campaign()?.revision ?? this.generationRevision();
    if (!campaignId || this.generating()) return;

    this.generationError.set('');
    this.retryStage.set(undefined);
    this.generating.set(true);
    this.setStep(stage, 'active');
    try {
      const response = await this.request(`/api/admin/campaigns/${campaignId}/retry`, {
        method: 'POST',
        body: { expectedRevision, stage },
      });
      if (!response.ok) {
        await this.handleGenerationFailure(response, stage);
        this.generating.set(false);
        return;
      }
      const payload = (await response.json()) as { generation?: GenerationAcceptance };
      if (!payload.generation) {
        this.generationError.set('The generation was not accepted. Try again.');
        this.setStep(stage, 'failed');
        this.retryStage.set(stage);
        this.generating.set(false);
        return;
      }
      this.followGeneration(payload.generation);
    } catch {
      this.generationError.set('Campaigns cannot be reached right now. Try again.');
      this.setStep(stage, 'failed');
      this.retryStage.set(stage);
      this.generating.set(false);
    }
  }

  private followGeneration(accepted: GenerationAcceptance): void {
    this.generationCampaignId.set(accepted.campaignId);
    this.generationRevision.set(accepted.campaignRevision);
    const sequence = ++this.generationPollSequence;
    void this.pollGeneration(accepted.campaignId, sequence);
  }

  private async pollGeneration(campaignId: string, sequence: number): Promise<void> {
    while (sequence === this.generationPollSequence) {
      try {
        const response = await this.request(`/api/admin/campaigns/${campaignId}/status`);
        if (sequence !== this.generationPollSequence) return;
        if (response.status === 401) {
          this.expireSession();
          return;
        }
        if (!response.ok) {
          this.generationError.set(
            await this.apiErrorMessage(response, this.generationErrorFor(response.status)),
          );
          this.generating.set(false);
          return;
        }

        const payload = (await response.json()) as { status?: GenerationStatus };
        const status = payload.status;
        if (!status || status.campaignId !== campaignId) {
          this.generationError.set('Campaign progress came back incomplete. Try again.');
          this.generating.set(false);
          return;
        }
        this.generationError.set('');
        this.generationRevision.set(status.campaignRevision);
        this.stepStatus.set(stepsForGeneration(status.stage, status.state));

        if (status.campaignRevision > 0) await this.refreshOpenCampaign(campaignId, sequence);

        if (status.state === 'failed' || status.state === 'ambiguous') {
          this.generationError.set(generationFailureMessage(status));
          this.retryStage.set(status.stage);
          this.generating.set(false);
          await this.refreshCampaigns();
          return;
        }

        if (status.state === 'succeeded' && status.stage === 'prompts') {
          this.retryStage.set(undefined);
          this.generating.set(false);
          await Promise.all([
            this.refreshOpenCampaign(campaignId, sequence),
            this.refreshCampaigns(),
          ]);
          return;
        }
      } catch {
        if (sequence !== this.generationPollSequence) return;
        this.generationError.set('Campaign progress cannot be reached right now. Retrying…');
      }
      await pollDelay();
    }
  }

  protected onRowActivate(event: CxTableRowActivateEvent): void {
    const summary = this.campaigns().find(item => item.id === event.rowId);
    if (summary) {
      void this.openCampaign(summary);
    }
  }

  protected onRowMenu(event: CxTableRowMenuSelectEvent): void {
    const summary = this.campaigns().find(item => item.id === event.rowId);
    if (summary) {
      this.onCampaignMenu(summary, event.itemId);
    }
  }

  protected async openCampaign(summary: CampaignSummary): Promise<void> {
    const sequence = ++this.generationPollSequence;
    this.generationError.set('');
    this.copyError.set('');
    try {
      const response = await this.request(`/api/admin/campaigns/${summary.id}`);
      if (sequence !== this.generationPollSequence) return;
      if (!response.ok) {
        const message = await this.apiErrorMessage(
          response,
          'That campaign could not be opened. Try again.',
        );
        if (sequence !== this.generationPollSequence) return;
        this.generationError.set(message);
        await this.refreshCampaigns();
        return;
      }
      const payload = (await response.json().catch(() => ({}))) as CampaignResponse;
      if (sequence !== this.generationPollSequence) return;
      if (!payload.campaign) {
        this.generationError.set('That campaign could not be opened. Try again.');
        await this.refreshCampaigns();
        return;
      }
      this.campaign.set(payload.campaign);
      this.generationCampaignId.set(payload.campaign.id);
      this.generationRevision.set(payload.campaign.revision);
      this.stepStatus.set(stepsForStage(payload.campaign.stage));
      this.setCopyWarning(payload.campaign);
      this.language.set(DEFAULT_LANGUAGE);
      this.view.set('campaign');
    } catch {
      if (sequence !== this.generationPollSequence) return;
      this.generationError.set('Campaigns cannot be reached right now. Try again.');
    }
  }

  /**
   * Both entry points — the list card menu and the open campaign's top bar — drive the same
   * action set through this one handler, so the entity's actions cannot drift apart.
   */
  protected onCampaignMenu(summary: CampaignSummary, action: string): void {
    if (action === 'delete') {
      this.pendingDelete.set(summary);
    }
  }

  protected onOpenCampaignMenu(action: string): void {
    const current = this.campaign();
    if (current) {
      this.onCampaignMenu(current, action);
    }
  }

  protected cancelDelete(): void {
    this.pendingDelete.set(undefined);
  }

  protected async confirmDelete(): Promise<void> {
    const target = this.pendingDelete();
    this.pendingDelete.set(undefined);
    if (!target) {
      return;
    }
    let deleted = false;
    try {
      const response = await this.request(`/api/admin/campaigns/${target.id}`, {
        method: 'DELETE',
        headers: { 'If-Match': `"${String(target.revision)}"` },
      });
      if (!response.ok) {
        this.generationError.set(
          await this.apiErrorMessage(response, 'That campaign could not be deleted.'),
        );
        return;
      }
      deleted = true;
    } catch {
      this.generationError.set('That campaign could not be deleted. Check the connection.');
    } finally {
      if (deleted && this.campaign()?.id === target.id) {
        this.showCampaigns();
      }
      await this.refreshCampaigns();
    }
  }

  protected selectLanguage(id: string): void {
    if (id === 'sv' || id === 'en') {
      this.language.set(id);
    }
  }

  protected updateField(fieldId: string, value: string): void {
    this.mutateCopy(copy => ({ ...copy, [fieldKey(fieldId)]: value }));
  }

  protected updateHashtags(values: string[]): void {
    // A tag field commits on add and remove rather than on blur, so the change is the commit.
    this.mutateCopy(copy => ({ ...copy, hashtags: values }));
    void this.onFieldBlur('hashtags', false);
  }

  /**
   * Saving happens on blur: the owner never hunts for a save button and there is no unsaved state
   * to warn about. A failed write says so and leaves the typed text alone.
   */
  protected async onFieldBlur(fieldId: string, focused: boolean): Promise<void> {
    const campaign = this.campaign();
    const copy = this.activeCopy();
    if (focused || !campaign || !copy) {
      return;
    }
    const value = fieldId === 'hashtags' ? copy.hashtags : copy[fieldKey(fieldId)];
    this.copySaveQueue = this.copySaveQueue
      .then(() => this.saveCopyField(campaign.id, this.language(), fieldId, value))
      .catch(() => {
        this.generationError.set('That change could not be saved. Check the connection.');
      });
    await this.copySaveQueue;
  }

  private async saveCopyField(
    campaignId: string,
    language: Language,
    fieldId: string,
    value: string | readonly string[],
  ): Promise<void> {
    const expectedRevision = this.campaign()?.revision;
    if (!expectedRevision || this.campaign()?.id !== campaignId) return;
    try {
      const response = await this.request(`/api/admin/campaigns/${campaignId}/copy`, {
        method: 'PATCH',
        body: { expectedRevision, language, field: fieldId, value },
      });
      if (!response.ok) {
        this.generationError.set(
          await this.apiErrorMessage(response, 'That change could not be saved.'),
        );
        if (response.status === 409) await this.refreshOpenCampaign(campaignId);
        return;
      }
      const payload = (await response.json()) as { revision?: number; updatedAt?: string };
      if (!Number.isSafeInteger(payload.revision) || (payload.revision ?? 0) < 1) {
        throw new Error('The save response did not include a campaign revision.');
      }
      this.campaign.update(current =>
        current?.id === campaignId
          ? {
              ...current,
              revision: payload.revision as number,
              updatedAt: payload.updatedAt ?? current.updatedAt,
            }
          : current,
      );
      this.generationRevision.set(payload.revision as number);
      this.generationError.set('');
    } catch {
      this.generationError.set('That change could not be saved. Check the connection.');
    }
  }

  private mutateCopy(change: (copy: LanguageCopy) => LanguageCopy): void {
    const language = this.language();
    this.campaign.update(campaign => {
      const copy = campaign?.copy[language];
      return campaign && copy
        ? { ...campaign, copy: { ...campaign.copy, [language]: change(copy) } }
        : campaign;
    });
  }

  protected async copyValue(id: string, value: string): Promise<void> {
    if (!this.browser || !value) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      this.copiedId.set(id);
      this.clearCopyTimer();
      this.copyResetTimer = setTimeout(() => this.copiedId.set(''), 2_000);
    } catch {
      this.generationError.set('Copying failed. Select the text and copy it manually.');
    }
  }

  protected campaignDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Unknown date' : DATE_FORMAT.format(date);
  }

  protected stageLabel(stage: CampaignStage): string {
    return stage === 'complete' ? 'Ready' : stage === 'copy' ? 'No image prompts' : 'No copy yet';
  }

  protected onAccountMenu(itemId: string): void {
    const mode = itemId.startsWith('theme:') ? itemId.slice('theme:'.length) : '';
    if (!isCxThemeMode(mode)) {
      return;
    }
    this.applyTheme(mode);
    try {
      this.document.defaultView?.localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // A blocked storage quota must not stop the theme from applying for this session.
    }
  }

  /** Applies the theme without persisting, so restoring a stored choice cannot overwrite it. */
  private applyTheme(mode: CxThemeMode): void {
    const root = this.document.documentElement;
    for (const definition of CX_THEMES) {
      root.classList.toggle(`theme-${definition.id}`, definition.id === mode);
    }
    this.theme.set(mode);
  }

  private restoreTheme(): void {
    let stored: string | null = null;
    try {
      stored = this.document.defaultView?.localStorage.getItem(THEME_STORAGE_KEY) ?? null;
    } catch {
      stored = null;
    }
    this.applyTheme(isCxThemeMode(stored) ? stored : DEFAULT_THEME);
  }

  protected closeMobileNav(): void {
    this.mobileNavOpen.set(false);
  }

  protected toggleMobileNav(): void {
    this.mobileNavOpen.update(open => !open);
  }

  private rulesFor(ruleIds: string[]): MarketingRule[] {
    const index = this.ruleIndex();
    return ruleIds.map(id => index.get(id)).filter((rule): rule is MarketingRule => Boolean(rule));
  }

  private setStep(step: GenerationStep, status: StepStatus): void {
    this.stepStatus.update(current => ({ ...current, [step]: status }));
  }

  private async restoreSession(): Promise<void> {
    try {
      const response = await this.request('/api/admin/session');
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as AuthResponse;
      this.authenticated.set(payload.authenticated === true);
      if (payload.authenticated) {
        await this.loadWorkspace();
      }
    } catch {
      // The login form remains available when the development auth server is not running.
    }
  }

  private async loadWorkspace(): Promise<void> {
    await Promise.all([this.loadConfig(), this.refreshCampaigns()]);
    await this.recoverGenerationWork();
  }

  private async recoverGenerationWork(): Promise<void> {
    const sequence = ++this.generationPollSequence;
    try {
      const response = await this.request('/api/admin/generations');
      if (sequence !== this.generationPollSequence || !this.authenticated()) return;
      if (response.status === 401) {
        this.expireSession();
        return;
      }
      if (!response.ok) return;

      const payload = (await response.json()) as RecoverableGenerationsResponse;
      if (sequence !== this.generationPollSequence || !this.authenticated()) return;
      const statuses = payload.generations ?? [];
      const status =
        statuses.find(candidate => candidate.state === 'queued' || candidate.state === 'running') ??
        statuses[0];
      if (!status) return;

      this.generationCampaignId.set(status.campaignId);
      this.generationRevision.set(status.campaignRevision);
      this.stepStatus.set(stepsForGeneration(status.stage, status.state));
      this.view.set('campaign');
      if (status.campaignRevision > 0) {
        await this.refreshOpenCampaign(status.campaignId, sequence);
      }
      if (sequence !== this.generationPollSequence) return;

      if (status.state === 'failed' || status.state === 'ambiguous') {
        this.generationError.set(generationFailureMessage(status));
        this.retryStage.set(status.stage);
        this.generating.set(false);
        return;
      }
      this.generationError.set('');
      this.retryStage.set(undefined);
      this.generating.set(true);
      void this.pollGeneration(status.campaignId, sequence);
    } catch {
      // Durable work remains on the server. A later login or explicit refresh can recover it.
    }
  }

  private async loadConfig(): Promise<void> {
    try {
      const response = await this.request('/api/admin/config');
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as ConfigResponse;
      this.fields.set(payload.fields ?? []);
      this.rules.set(payload.rules ?? []);
      this.maxIdeaCharacters.set(payload.maxIdeaCharacters ?? FALLBACK_MAX_IDEA_CHARACTERS);
    } catch {
      // Character meters and explanations stay empty rather than showing invented limits.
    }
  }

  private async refreshCampaigns(): Promise<void> {
    try {
      const response = await this.request('/api/admin/campaigns');
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as { campaigns?: CampaignSummary[] };
      this.campaigns.set(payload.campaigns ?? []);
    } catch {
      // Keep the current list rather than clearing it on a transient failure.
    }
  }

  private async refreshOpenCampaign(
    campaignId: string,
    generationSequence?: number,
  ): Promise<void> {
    const response = await this.request(`/api/admin/campaigns/${campaignId}`);
    if (
      generationSequence !== undefined &&
      generationSequence !== this.generationPollSequence
    ) {
      return;
    }
    if (!response.ok) return;
    const payload = (await response.json()) as CampaignResponse;
    if (
      generationSequence !== undefined &&
      generationSequence !== this.generationPollSequence
    ) {
      return;
    }
    if (!payload.campaign) return;
    this.campaign.set(payload.campaign);
    this.generationRevision.set(payload.campaign.revision);
    this.setCopyWarning(payload.campaign);
  }

  private setCopyWarning(campaign: Campaign): void {
    const missing = (['en', 'sv'] as const).filter(language => !campaign.copy[language]);
    this.copyError.set(
      missing.length === 1
        ? `The ${missing[0] === 'en' ? 'English' : 'Swedish'} copy is still missing. Retry campaign copy to create both languages.`
        : '',
    );
  }

  private async handleGenerationFailure(
    response: Response,
    stage: GenerationStep,
    retryable = true,
  ): Promise<void> {
    if (response.status === 401) {
      this.expireSession();
      return;
    }
    this.generationError.set(
      await this.apiErrorMessage(response, this.generationErrorFor(response.status)),
    );
    this.setStep(stage, 'failed');
    this.retryStage.set(retryable ? stage : undefined);
  }

  private expireSession(): void {
    this.generationPollSequence += 1;
    this.authenticated.set(false);
    this.requestError.set('Your session expired. Sign in again.');
    this.resetStudio();
  }

  private async apiErrorMessage(response: Response, fallback: string): Promise<string> {
    const payload = (await response.json().catch(() => ({}))) as ApiError;
    return payload.error?.message || fallback;
  }

  private generationErrorFor(status: number): string {
    if (status === 429) {
      return 'Campaigns is busy right now. Try again shortly.';
    }
    if (status === 503) {
      return 'OpenAI is not connected yet. Add the API key to the worker-owned .env.worker file and restart the jobs worker.';
    }
    if (status === 504) {
      return 'The campaign took too long to create. Try again.';
    }
    return 'The campaign could not be created right now. Try again.';
  }

  private findPublicStylesheet(): HTMLLinkElement | undefined {
    return Array.from(
      this.document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
    ).find(link => link.getAttribute('href')?.startsWith('/assets/styles/styles.css'));
  }

  private originalPublicStylesheetMedia(): string | null {
    const media = this.publicStylesheet?.getAttribute('media') ?? null;
    return media === 'not all' ? null : media;
  }

  private resetStudio(): void {
    this.view.set('list');
    this.campaigns.set([]);
    this.campaign.set(undefined);
    this.roughIdea.set('');
    this.roughIdeaValidation.set(undefined);
    this.generationError.set('');
    this.copyError.set('');
    this.generating.set(false);
    this.stepStatus.set(idleSteps());
    this.generationCampaignId.set('');
    this.generationRevision.set(0);
    this.retryStage.set(undefined);
    this.language.set(DEFAULT_LANGUAGE);
    this.copiedId.set('');
    this.pendingDelete.set(undefined);
    this.mobileNavOpen.set(false);
    this.composeOpen.set(false);
    this.clearCopyTimer();
  }

  private clearCopyTimer(): void {
    if (this.copyResetTimer) {
      clearTimeout(this.copyResetTimer);
      this.copyResetTimer = undefined;
    }
  }

  private request(
    path: string,
    options: {
      body?: object;
      headers?: Readonly<Record<string, string>>;
      method?: 'DELETE' | 'GET' | 'PATCH' | 'POST';
    } = {},
  ): Promise<Response> {
    const init: RequestInit = {
      credentials: 'same-origin',
      method: options.method ?? 'GET',
    };
    if (options.body) {
      init.body = JSON.stringify(options.body);
      init.headers = { ...options.headers, 'Content-Type': 'application/json' };
    } else if (options.headers) {
      init.headers = options.headers;
    }
    return fetch(path, init);
  }
}

function idleSteps(): Record<GenerationStep, StepStatus> {
  return { strategy: 'waiting', copy: 'waiting', prompts: 'waiting' };
}

function stepsForStage(stage: CampaignStage): Record<GenerationStep, StepStatus> {
  return {
    strategy: 'done',
    copy: stage === 'strategy' ? 'waiting' : 'done',
    prompts: stage === 'complete' ? 'done' : 'waiting',
  };
}

function stepsForGeneration(
  stage: GenerationStep,
  state: GenerationState,
): Record<GenerationStep, StepStatus> {
  const order: readonly GenerationStep[] = ['strategy', 'copy', 'prompts'];
  const selected = order.indexOf(stage);
  return {
    strategy: generationStepState(0, selected, state),
    copy: generationStepState(1, selected, state),
    prompts: generationStepState(2, selected, state),
  };
}

function generationStepState(
  index: number,
  selected: number,
  state: GenerationState,
): StepStatus {
  if (index < selected) return 'done';
  if (index > selected) return 'waiting';
  if (state === 'succeeded') return 'done';
  if (state === 'failed' || state === 'ambiguous') return 'failed';
  return 'active';
}

function generationFailureMessage(status: GenerationStatus): string {
  return (
    status.error?.message ??
    (status.state === 'ambiguous'
      ? 'The provider may have received the request, so it was not sent again. Review and retry it manually.'
      : 'The campaign stage failed. Try it again.')
  );
}

function pollDelay(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 1_000));
}

function fieldKey(id: string): EditableTextField {
  if (
    id === 'headline' ||
    id === 'description' ||
    id === 'primaryText' ||
    id === 'fullCaption' ||
    id === 'callToAction'
  ) {
    return id;
  }
  throw new Error(`Unknown editable campaign copy field: ${id}`);
}

/** Code points, matching how the server counts against each budget. */
function characterCount(value: string): number {
  return [...value].length;
}
