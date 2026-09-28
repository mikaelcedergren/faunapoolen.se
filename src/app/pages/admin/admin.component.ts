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
  CxButtonGroupComponent,
  CxCardComponent,
  CxCodeBlockComponent,
  CxDialogComponent,
  CxIconButtonComponent,
  CxInlineComponent,
  CxItemCardComponent,
  CxLabeledRowComponent,
  CxPasswordFieldComponent,
  CxSideNavComponent,
  CxSidebarLayoutComponent,
  CxSpinnerComponent,
  CxStackComponent,
  CxStateMessageComponent,
  CxStatusTagComponent,
  CxTableComponent,
  CxTabsComponent,
  CxTagFieldComponent,
  CxTextAreaComponent,
  CxTextFieldComponent,
  CxTopBarComponent,
  CxTooltipDirective,
  type CxButtonGroupOption,
  type CxTagFieldTag,
  type CxFieldValidation,
  type CxLabeledRowContent,
  type CxMenuItem,
  type CxSideNavItem,
  type CxStateMessageAction,
  type CxTabItem,
  type CxTableColumn,
  type CxTableRow,
  type CxTableRowActivateEvent,
  type CxThemeMode,
  type CxTopBarTitle,
  CX_THEMES,
  CX_THEME_ICONS,
  CX_THEME_LABELS,
  cxThemeStartsGroup,
  isCxThemeMode,
} from '@mikaelcedergren/cx-framework';

type AuthResponse = { authenticated?: boolean; ok?: boolean };

type Language = 'en' | 'sv';
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
type CampaignSection = 'copy' | 'prompts' | 'strategy';
type CopyEdit = {
  campaignId: string;
  language: Language;
  fieldId: string;
  value: string | readonly string[];
  sequence: number;
  state: 'dirty' | 'saving' | 'saved' | 'failed';
  error?: string;
};

type CopyFieldConfig = {
  id: string;
  label: string;
  budget: number;
  reason: string;
  guidance: string;
  multiline: boolean;
};

type MarketingRule = { id: string; name: string; teaches: string };

type Rationale = {
  field?: string;
  topic?: string;
  ruleIds: string[];
  why?: string;
  guidance?: string;
};

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

type CopyDraft = Pick<LanguageCopy, EditableTextField | 'hashtags'>;
type Refinement = { runId: string; language: Language; summary: string };

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
  refinement?: Refinement;
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
  refinement?: { runId: string; language: Language; draft: CopyDraft; expectedRevision: number };
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
  alternatives: string[];
  rationale?: Rationale;
  saveError?: string;
};

type LabeledRow = { label: string; content: CxLabeledRowContent };

type PromptSection = {
  concept: string;
  label: string;
  code: string;
  altText: string;
  why: string;
};

const DEFAULT_THEME: CxThemeMode = 'light';
const THEME_STORAGE_KEY = 'fp-admin-theme';
const FALLBACK_MAX_IDEA_CHARACTERS = 3_000;
const MIN_IDEA_CHARACTERS = 8;

const EXAMPLE_IDEA =
  'I want to show that a natural swimming pond can feel like part of the garden. The campaign should make the first step feel calm and manageable, even for someone who does not yet know what they need.';

const DEFAULT_LANGUAGE: Language = 'en';
const LANGUAGE_OPTIONS: CxButtonGroupOption[] = [
  { id: 'en', label: 'English' },
  { id: 'sv', label: 'Swedish' },
];

const CAMPAIGN_COLUMNS: CxTableColumn[] = [
  { id: 'name', label: 'Campaign', key: true, size: 'flex', hideable: false, pinnable: false },
  {
    id: 'updated',
    label: 'Updated',
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

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

@Component({
  selector: 'fp-admin',
  imports: [
    CxAccountControlComponent,
    CxAlertComponent,
    CxButtonComponent,
    CxButtonGroupComponent,
    CxCardComponent,
    CxCodeBlockComponent,
    CxDialogComponent,
    CxIconButtonComponent,
    CxInlineComponent,
    CxItemCardComponent,
    CxLabeledRowComponent,
    CxPasswordFieldComponent,
    CxSideNavComponent,
    CxSidebarLayoutComponent,
    CxSpinnerComponent,
    CxStackComponent,
    CxStateMessageComponent,
    CxStatusTagComponent,
    CxTableComponent,
    CxTabsComponent,
    CxTagFieldComponent,
    CxTextFieldComponent,
    CxTextAreaComponent,
    CxTopBarComponent,
    CxTooltipDirective,
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
  private editSequence = 0;
  private copySaving = false;
  private pendingLeave?: () => void;
  private pendingRouteDecision?: (allow: boolean) => void;
  private readonly protectUnsavedWork = (event: BeforeUnloadEvent): void => {
    if (this.generating() || this.hasUnsavedCopy() || this.roughIdea().trim()) {
      event.preventDefault();
      event.returnValue = '';
    }
  };

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
  protected readonly section = signal<CampaignSection>('copy');
  protected readonly listLoading = signal(true);
  protected readonly listError = signal('');
  protected readonly configLoading = signal(true);
  protected readonly configError = signal('');
  protected readonly openingCampaign = signal(false);
  protected readonly generationStatuses = signal<GenerationStatus[]>([]);
  protected readonly copyEdits = signal<Record<string, CopyEdit>>({});
  protected readonly refining = signal(false);
  protected readonly dismissedRefinement = signal<string | undefined>(undefined);
  protected readonly refinementNotice = computed(() => {
    const receipt = this.campaign()?.refinement;
    return receipt &&
      (receipt.language === 'en' || receipt.language === this.language()) &&
      receipt.runId !== this.dismissedRefinement()
      ? receipt
      : undefined;
  });
  protected readonly leaveOpen = signal(false);
  protected readonly leaving = signal(false);
  protected readonly sideNavCollapsed = signal(false);
  private navigationViewport: MediaQueryList | undefined;
  private readonly adaptNavigationToViewport = (event: MediaQueryListEvent): void => {
    this.sideNavCollapsed.set(event.matches);
  };
  protected readonly selectedFieldId = signal('headline');
  protected readonly inspectedPrompt = signal<PromptSection | undefined>(undefined);
  protected readonly sideNavItems: CxSideNavItem[] = [
    {
      id: 'campaign-studio',
      label: 'Campaign Studio',
      icon: 'form',
      routerLink: '/admin',
      routerLinkActiveOptions: { exact: true },
    },
  ];
  protected readonly sectionTabs: CxTabItem[] = [
    { id: 'copy', label: 'Copy' },
    { id: 'prompts', label: 'Image prompts' },
    { id: 'strategy', label: 'Strategy' },
  ];
  protected readonly sectionPanelLabel = computed(
    () => `fp-campaign-panel-tab-${this.sectionTabs.findIndex((tab) => tab.id === this.section())}`,
  );
  protected readonly reloadAction: CxStateMessageAction = { text: 'Try again', icon: 'reload' };
  protected readonly hasUnsavedCopy = computed(() =>
    Object.values(this.copyEdits()).some((edit) => edit.state !== 'saved'),
  );
  protected readonly copySaveStatus = computed(() => {
    const edits = Object.values(this.copyEdits());
    if (edits.some((edit) => edit.state === 'failed')) return 'Changes not saved';
    if (edits.some((edit) => edit.state === 'saving')) return 'Saving changes';
    if (edits.some((edit) => edit.state === 'dirty')) return 'Unsaved changes';
    return edits.length ? 'Changes saved' : '';
  });
  protected readonly copySaveFailed = computed(() =>
    Object.values(this.copyEdits()).some((edit) => edit.state === 'failed'),
  );
  protected readonly generationHeading = computed(() => {
    const stage = this.stepStatus();
    if (this.retryStage()) return 'Generation needs attention';
    if (!this.generating()) return 'Continue this campaign';
    if (this.refining()) return 'Refining copy';
    if (stage.strategy === 'active') return 'Creating strategy';
    if (stage.copy === 'active') return 'Writing campaign copy';
    return 'Creating image prompts';
  });
  protected readonly generationProgress = computed(() => {
    const stage = this.stepStatus();
    if (stage.strategy === 'active') return 'Step 1 of 3';
    if (stage.copy === 'active') return 'Step 2 of 3';
    return 'Step 3 of 3';
  });
  protected readonly campaigns = signal<CampaignSummary[]>([]);
  protected readonly campaign = signal<Campaign | undefined>(undefined);
  protected readonly fields = signal<CopyFieldConfig[]>([]);
  protected readonly rules = signal<MarketingRule[]>([]);
  protected readonly maxIdeaCharacters = signal(FALLBACK_MAX_IDEA_CHARACTERS);

  protected readonly roughIdea = signal('');
  protected readonly exampleIdea = EXAMPLE_IDEA;
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
  protected readonly clipboardError = signal('');
  protected readonly composeOpen = signal(false);

  protected readonly languageOptions = LANGUAGE_OPTIONS;
  private pendingHashtagOptions: readonly CxTagFieldTag[] | undefined;
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

  private readonly ruleIndex = computed(() => new Map(this.rules().map((rule) => [rule.id, rule])));

  protected readonly activeCopy = computed(() => this.campaign()?.copy[this.language()]);

  protected readonly resolvedFields = computed<ResolvedField[]>(() => {
    const copy = this.activeCopy();
    if (!copy) {
      return [];
    }
    const rationales = new Map(
      (this.campaign()?.copy.en?.rationale ?? [])
        .filter((entry) => entry.field)
        .map((entry) => [entry.field as string, entry]),
    );
    const order = [
      'headline',
      'primaryText',
      'fullCaption',
      'callToAction',
      'description',
      'hashtags',
    ];
    return [...this.fields()]
      .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
      .map((field) => {
        const rationale = rationales.get(field.id);
        const tags = field.id === 'hashtags' ? copy.hashtags : [];
        const value =
          field.id === 'hashtags' ? tags.join(' ') : String(copy[fieldKey(field.id)] ?? '');
        // Hashtags are budgeted per tag, so the count reports the longest one rather than the line.
        const used =
          field.id === 'hashtags'
            ? Math.max(0, ...tags.map(characterCount))
            : characterCount(value);
        return {
          ...field,
          value,
          tags,
          used,
          rationale,
          guidance:
            sidebarGuidance(rationale?.why || rationale?.guidance || field.guidance) ||
            field.guidance,
          hint:
            field.id === 'hashtags'
              ? `${used}/${field.budget} characters per tag`
              : `${used}/${field.budget} characters`,
          alternatives:
            field.id === 'headline' || field.id === 'primaryText' ? copy.variations[field.id] : [],
          saveError: this.copyEdits()[`${this.language()}:${field.id}`]?.error,
          // The field swaps the hint for validation, so advice and correction never stack up.
          validation:
            used > field.budget
              ? `Remove ${used - field.budget} characters to fit the ${field.budget}-character limit.`
              : undefined,
        };
      });
  });

  protected readonly campaignColumns = CAMPAIGN_COLUMNS;

  protected readonly campaignRows = computed<CxTableRow[]>(() =>
    [...this.campaigns()]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((item) => ({
        id: item.id,
        cells: {
          name: { kind: 'text', value: item.name, strong: true },
          updated: { kind: 'text', value: this.campaignDate(item.updatedAt), muted: true },
        },
      })),
  );

  /** The tag field needs the available set as well as the selected ids. */
  protected readonly hashtagTags = computed(() =>
    (this.activeCopy()?.hashtags ?? []).map((tag) => ({ id: tag, name: tag })),
  );

  protected readonly selectedField = computed(() =>
    this.resolvedFields().find((field) => field.id === this.selectedFieldId()),
  );

  protected readonly selectedFieldRules = computed(() =>
    this.rulesFor(this.selectedField()?.rationale?.ruleIds ?? []),
  );

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

  protected readonly strategyWhyRows = computed<LabeledRow[]>(() =>
    (this.campaign()?.strategy.rationale ?? []).map((entry) => ({
      label: STRATEGY_TOPIC_LABELS[entry.topic ?? ''] ?? 'Why this decision',
      content: { kind: 'text', text: entry.why ?? '' },
    })),
  );

  // Composed once per campaign so the template never rebuilds labeled-row content objects on
  // every change-detection pass.
  protected readonly promptSections = computed<PromptSection[]>(() =>
    (this.campaign()?.imagePrompts ?? []).map((prompt) => ({
      concept: prompt.concept,
      label: prompt.label,
      code: prompt.prompt,
      altText: prompt.altText,
      why: prompt.why,
    })),
  );

  protected readonly topBarTitle = computed<CxTopBarTitle>(() => {
    const root = { id: 'campaign-studio', label: 'Campaign Studio' };
    if (this.view() === 'campaign') {
      return {
        kind: 'breadcrumbs',
        items: [
          root,
          {
            id: 'campaign',
            label: this.campaign()?.name ?? (this.generating() ? 'Creating campaign' : 'Campaign'),
          },
        ],
        currentId: 'campaign',
        ariaLabel: 'Campaign location',
      };
    }
    return {
      kind: 'breadcrumbs',
      items: [root],
      currentId: 'campaign-studio',
      ariaLabel: 'Campaign location',
    };
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

  public constructor() {
    // The admin screens are a cx-framework surface inside a site whose public stylesheet is global.
    // Suppressing that one link keeps the public-site cascade off /admin without touching either
    // stylesheet; both are restored when the route is left.
    this.applyTheme(this.theme());
    this.publicStylesheet?.setAttribute('media', 'not all');
  }

  public ngOnInit(): void {
    if (this.browser) {
      this.document.defaultView?.addEventListener('beforeunload', this.protectUnsavedWork);
      this.navigationViewport = this.document.defaultView?.matchMedia('(max-width: 719px)');
      this.sideNavCollapsed.set(this.navigationViewport?.matches ?? false);
      this.navigationViewport?.addEventListener('change', this.adaptNavigationToViewport);
      this.restoreTheme();
      void this.restoreSession();
    }
  }

  public ngOnDestroy(): void {
    this.navigationViewport?.removeEventListener('change', this.adaptNavigationToViewport);
    this.document.defaultView?.removeEventListener('beforeunload', this.protectUnsavedWork);
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

  protected requestSignOut(): void {
    if (this.generating()) return;
    void this.leaveCampaign(() => {
      void this.signOut();
    }, true);
  }

  private async signOut(): Promise<void> {
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
    if (this.generating()) return;
    this.roughIdeaValidation.set(undefined);
    this.generationError.set('');
    this.composeOpen.set(true);
    queueMicrotask(() => this.roughIdeaField?.focus());
  }

  protected closeCompose(): void {
    if (this.generating()) return;
    this.composeOpen.set(false);
    this.generationError.set('');
  }

  protected showCampaigns(): void {
    if (this.generating()) return;
    void this.leaveCampaign(() => {
      this.view.set('list');
      this.campaign.set(undefined);
      this.generationError.set('');
      this.copyError.set('');
      this.clipboardError.set('');
      this.copiedId.set('');
      void this.refreshCampaigns();
    });
  }

  protected onBreadcrumbSelect(id: string): void {
    if (id === 'campaign-studio') this.showCampaigns();
  }

  protected onSideNavSelect(item: CxSideNavItem): void {
    if (item.id === 'campaign-studio') this.showCampaigns();
  }

  protected selectSection(id: string): void {
    if (id === 'copy' || id === 'prompts' || id === 'strategy') {
      void this.saveChanges();
      this.section.set(id);
    }
  }

  protected reviewUnsavedChanges(): void {
    const edit = Object.values(this.copyEdits()).find((item) => item.state === 'failed');
    this.section.set('copy');
    if (edit) this.language.set(edit.language);
  }

  private async leaveCampaign(action: () => void, includeIdea = false): Promise<void> {
    if (this.leaving()) return;
    this.leaving.set(true);
    await this.saveChanges();
    this.leaving.set(false);
    if (this.hasUnsavedCopy() || (includeIdea && this.roughIdea().trim())) {
      this.pendingLeave = action;
      this.leaveOpen.set(true);
      return;
    }
    this.copyEdits.set({});
    action();
  }

  public async canLeave(): Promise<boolean> {
    if (this.generating()) return false;
    await this.saveChanges();
    if (!this.hasUnsavedCopy() && !this.roughIdea().trim()) return true;
    this.pendingRouteDecision?.(false);
    return new Promise((resolve) => {
      this.pendingRouteDecision = resolve;
      this.leaveOpen.set(true);
    });
  }

  protected keepEditing(): void {
    this.pendingRouteDecision?.(false);
    this.pendingRouteDecision = undefined;
    this.leaveOpen.set(false);
    this.pendingLeave = undefined;
    this.reviewUnsavedChanges();
  }

  protected discardAndLeave(): void {
    const action = this.pendingLeave;
    this.pendingLeave = undefined;
    this.leaveOpen.set(false);
    this.copyEdits.set({});
    this.roughIdea.set('');
    this.pendingRouteDecision?.(true);
    this.pendingRouteDecision = undefined;
    action?.();
  }

  protected updateRoughIdea(value: string): void {
    this.roughIdea.set(value);
    this.roughIdeaValidation.set(undefined);
    this.generationError.set('');
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
    this.refining.set(false);
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
      this.roughIdea.set('');
      this.section.set('copy');
      this.selectedFieldId.set('headline');
      this.campaign.set(undefined);
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

  protected async refineCopy(): Promise<void> {
    if (this.generating() || !this.activeCopy()) return;
    this.refining.set(true);
    this.generating.set(true);
    this.generationError.set('');
    this.retryStage.set(undefined);
    // Wait for a save already in flight; the draft itself may exceed final copy limits.
    await this.copySaveQueue;
    const campaign = this.campaign();
    const copy = this.activeCopy();
    if (!campaign || !copy) {
      this.generating.set(false);
      return;
    }
    const language = this.language();
    const draft: CopyDraft = {
      headline: copy.headline,
      description: copy.description,
      primaryText: copy.primaryText,
      fullCaption: copy.fullCaption,
      callToAction: copy.callToAction,
      hashtags: [...copy.hashtags],
    };
    try {
      const response = await this.request(`/api/admin/campaigns/${campaign.id}/refine`, {
        method: 'POST',
        body: { expectedRevision: campaign.revision, language, draft },
      });
      if (!response.ok) {
        if (response.status === 401) {
          this.expireSession();
          return;
        }
        this.generationError.set(
          await this.apiErrorMessage(
            response,
            'The copy could not be refined. Your draft is kept here.',
          ),
        );
        if (response.status === 409) await this.refreshOpenCampaign(campaign.id);
        this.generating.set(false);
        return;
      }
      const payload = (await response.json()) as { generation?: GenerationAcceptance };
      if (!payload.generation) throw new Error('Missing refinement acceptance');
      this.followGeneration(payload.generation);
    } catch {
      // Admission may have succeeded despite a lost response. Recover its durable status before resubmitting.
      this.generationError.set('Checking refinement progress…');
      const sequence = ++this.generationPollSequence;
      void this.pollGeneration(campaign.id, sequence, campaign.revision);
    }
  }

  protected async retryGeneration(): Promise<void> {
    const stage = this.retryStage();
    if (stage) await this.startTargetedGeneration(stage);
  }

  private async startTargetedGeneration(stage: GenerationStep): Promise<void> {
    await this.saveChanges();
    if (this.hasUnsavedCopy()) {
      this.reviewUnsavedChanges();
      return;
    }
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

  private async pollGeneration(
    campaignId: string,
    sequence: number,
    expectedRefinementRevision?: number,
  ): Promise<void> {
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
        if (
          expectedRefinementRevision !== undefined &&
          status.refinement?.expectedRevision !== expectedRefinementRevision
        ) {
          this.generationError.set(
            'Refinement was not confirmed. Your draft is kept here. Try again.',
          );
          this.generating.set(false);
          return;
        }
        this.generationError.set('');
        this.generationStatuses.update((items) => [
          status,
          ...items.filter((item) => item.campaignId !== status.campaignId),
        ]);
        this.generationRevision.set(status.campaignRevision);
        this.stepStatus.set(stepsForGeneration(status.stage, status.state));
        this.refining.set(Boolean(status.refinement));

        if (status.campaignRevision > 0)
          await this.refreshOpenCampaign(campaignId, sequence, status);

        if (status.state === 'failed' || status.state === 'ambiguous') {
          this.generationError.set(generationFailureMessage(status));
          this.retryStage.set(status.stage);
          this.generating.set(false);
          await this.refreshCampaigns();
          return;
        }

        if (
          status.state === 'succeeded' &&
          (status.stage === 'prompts' || status.refinement || this.campaign()?.stage === 'complete')
        ) {
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
    const summary = this.campaigns().find((item) => item.id === event.rowId);
    if (summary) {
      void this.openCampaign(summary);
    }
  }

  protected async openCampaign(summary: CampaignSummary): Promise<void> {
    const sequence = ++this.generationPollSequence;
    this.generationError.set('');
    this.copyError.set('');
    this.openingCampaign.set(true);
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
      this.copyEdits.set({});
      this.section.set('copy');
      this.selectedFieldId.set('headline');
      this.campaign.set(payload.campaign);
      this.generationCampaignId.set(payload.campaign.id);
      this.generationRevision.set(payload.campaign.revision);
      this.stepStatus.set(stepsForStage(payload.campaign.stage));
      this.setCopyWarning(payload.campaign);
      this.language.set(DEFAULT_LANGUAGE);
      this.view.set('campaign');
      const status = this.generationStatuses().find((item) => item.campaignId === summary.id);
      this.retryStage.set(undefined);
      this.generating.set(false);
      this.refining.set(Boolean(status?.refinement));
      if (status?.refinement) {
        this.language.set(status.refinement.language);
        await this.refreshOpenCampaign(summary.id, sequence, status);
      }
      if (status?.state === 'failed' || status?.state === 'ambiguous') {
        this.retryStage.set(status.stage);
        this.generationError.set(generationFailureMessage(status));
      } else if (status?.state === 'running' || status?.state === 'queued') {
        this.generating.set(true);
        void this.pollGeneration(summary.id, sequence);
      }
    } catch {
      if (sequence !== this.generationPollSequence) return;
      this.generationError.set('Campaigns cannot be reached right now. Try again.');
    } finally {
      this.openingCampaign.set(false);
    }
  }

  protected selectLanguage(id: string): void {
    if (this.generating()) return;
    if (id === 'sv' || id === 'en') {
      void this.saveChanges();
      this.language.set(id);
    }
  }

  protected updateField(fieldId: string, value: string): void {
    this.mutateCopy((copy) => ({ ...copy, [fieldKey(fieldId)]: value }));
    this.markCopyEdit(fieldId, value);
  }

  protected rememberHashtagOptions(tags: CxTagFieldTag[]): void {
    // Creation emits the option catalogue before its selected IDs; campaign copy stores names.
    this.pendingHashtagOptions = tags;
  }

  protected updateHashtags(ids: string[]): void {
    const options = new Map(
      (this.pendingHashtagOptions ?? this.hashtagTags()).map((tag) => [tag.id, tag.name]),
    );
    this.pendingHashtagOptions = undefined;
    const names = ids.map((id) => options.get(id));
    if (names.some((name) => name === undefined)) {
      this.copyError.set('That tag is no longer available. Reopen the campaign and try again.');
      return;
    }
    const values = [...new Set(names as string[])];
    this.mutateCopy((copy) => ({ ...copy, hashtags: values }));
    this.markCopyEdit('hashtags', values);
    void this.onFieldBlur('hashtags', false);
  }

  protected selectCopyField(fieldId: string): void {
    this.selectedFieldId.set(fieldId);
  }

  protected inspectPrompt(prompt: PromptSection): void {
    this.inspectedPrompt.set(prompt);
  }

  protected closePromptDialog(): void {
    this.inspectedPrompt.set(undefined);
  }

  private markCopyEdit(fieldId: string, value: CopyEdit['value']): void {
    const campaign = this.campaign();
    if (!campaign) return;
    const language = this.language();
    this.copyEdits.update((edits) => ({
      ...edits,
      [`${language}:${fieldId}`]: {
        campaignId: campaign.id,
        language,
        fieldId,
        value,
        sequence: ++this.editSequence,
        state: 'dirty',
      },
    }));
  }

  protected async onFieldBlur(fieldId: string, focused: boolean): Promise<void> {
    if (this.generating()) return;
    if (focused) return;
    const edit = this.copyEdits()[`${this.language()}:${fieldId}`];
    if (edit?.state === 'dirty') this.queueCopyEdit(edit);
    await this.copySaveQueue;
  }

  protected async retryCopyField(fieldId: string): Promise<void> {
    const edit = this.copyEdits()[`${this.language()}:${fieldId}`];
    if (edit?.state === 'failed') this.queueCopyEdit(edit);
    await this.copySaveQueue;
  }

  private async saveChanges(): Promise<void> {
    for (const edit of Object.values(this.copyEdits())) {
      if (edit.state === 'dirty') this.queueCopyEdit(edit);
    }
    await this.copySaveQueue;
  }

  private setEditState(edit: CopyEdit, state: CopyEdit['state'], error?: string): void {
    const key = `${edit.language}:${edit.fieldId}`;
    this.copyEdits.update((edits) =>
      edits[key]?.sequence === edit.sequence
        ? { ...edits, [key]: { ...edit, state, error } }
        : edits,
    );
  }

  private queueCopyEdit(edit: CopyEdit): void {
    this.setEditState(edit, 'saving');
    if (this.copySaving) return;
    this.copySaving = true;
    this.copySaveQueue = this.drainCopyEdits().finally(() => {
      this.copySaving = false;
    });
  }

  private async drainCopyEdits(): Promise<void> {
    // Coalesce pending edits in the bounded field map rather than accumulating promises.
    // An in-flight request retains its original campaign, language, revision and value.
    let edit: CopyEdit | undefined;
    while ((edit = Object.values(this.copyEdits()).find((item) => item.state === 'saving'))) {
      await this.saveCopyEdit(edit);
    }
  }

  private async saveCopyEdit(edit: CopyEdit): Promise<void> {
    const campaign = this.campaign();
    if (!campaign || campaign.id !== edit.campaignId) {
      this.setEditState(edit, 'failed', 'The campaign is no longer open.');
      return;
    }
    try {
      const response = await this.request(`/api/admin/campaigns/${edit.campaignId}/copy`, {
        method: 'PATCH',
        body: {
          expectedRevision: campaign.revision,
          language: edit.language,
          field: edit.fieldId,
          value: edit.value,
        },
      });
      if (!response.ok) {
        let message = await this.apiErrorMessage(
          response,
          'This change could not be saved. Try again.',
        );
        if (response.status === 409) {
          await this.refreshOpenCampaign(edit.campaignId);
          message =
            'This campaign changed elsewhere. Your edit is kept here. Review it, then retry to save it.';
        }
        this.setEditState(edit, 'failed', message);
        return;
      }
      const payload = (await response.json()) as { revision?: number; updatedAt?: string };
      if (!Number.isSafeInteger(payload.revision) || (payload.revision ?? 0) < 1) {
        throw new Error('Missing saved revision');
      }
      this.campaign.update((current) =>
        current?.id === edit.campaignId
          ? {
              ...current,
              revision: payload.revision as number,
              updatedAt: payload.updatedAt ?? current.updatedAt,
            }
          : current,
      );
      this.generationRevision.set(payload.revision as number);
      this.setEditState(edit, 'saved');
    } catch {
      this.setEditState(
        edit,
        'failed',
        'This change could not be saved. Check your connection and retry.',
      );
    }
  }

  private mutateCopy(change: (copy: LanguageCopy) => LanguageCopy): void {
    const language = this.language();
    this.campaign.update((campaign) => {
      const copy = campaign?.copy[language];
      return campaign && copy
        ? { ...campaign, copy: { ...campaign.copy, [language]: change(copy) } }
        : campaign;
    });
  }

  protected async copyValue(id: string, value: string): Promise<void> {
    this.clipboardError.set('');
    if (!this.browser || !value) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      this.copiedId.set(id);
      this.clearCopyTimer();
      this.copyResetTimer = setTimeout(() => this.copiedId.set(''), 2_000);
    } catch {
      this.clipboardError.set('Copying failed. Select the text and copy it manually.');
    }
  }

  protected campaignDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown date';
    const parts = DATE_FORMAT.formatToParts(date);
    return ['day', 'month', 'year']
      .map((type) => parts.find((part) => part.type === type)!.value)
      .join(' ');
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

  private rulesFor(ruleIds: string[]): MarketingRule[] {
    const index = this.ruleIndex();
    return ruleIds
      .map((id) => index.get(id))
      .filter((rule): rule is MarketingRule => Boolean(rule));
  }

  private setStep(step: GenerationStep, status: StepStatus): void {
    this.stepStatus.update((current) => ({ ...current, [step]: status }));
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
    if (!this.hasUnsavedCopy()) await this.recoverGenerationWork();
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
      this.generationStatuses.set(statuses);
      const status =
        statuses.find(
          (candidate) => candidate.state === 'queued' || candidate.state === 'running',
        ) ?? statuses[0];
      if (!status) return;

      this.generationCampaignId.set(status.campaignId);
      this.generationRevision.set(status.campaignRevision);
      this.stepStatus.set(stepsForGeneration(status.stage, status.state));
      this.refining.set(Boolean(status.refinement));
      if (status.refinement) this.language.set(status.refinement.language);
      this.view.set('campaign');
      if (status.campaignRevision > 0) {
        await this.refreshOpenCampaign(status.campaignId, sequence, status);
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

  protected async loadConfig(): Promise<void> {
    this.configLoading.set(true);
    this.configError.set('');
    try {
      const response = await this.request('/api/admin/config');
      if (!response.ok) throw new Error('Configuration unavailable');
      const payload = (await response.json()) as ConfigResponse;
      if (!payload.fields?.length) throw new Error('Missing copy fields');
      this.fields.set(payload.fields);
      this.rules.set(payload.rules ?? []);
      this.maxIdeaCharacters.set(payload.maxIdeaCharacters ?? FALLBACK_MAX_IDEA_CHARACTERS);
    } catch {
      this.configError.set('Writing guidance and limits could not be loaded.');
    } finally {
      this.configLoading.set(false);
    }
  }

  protected async refreshCampaigns(): Promise<void> {
    this.listLoading.set(true);
    this.listError.set('');
    try {
      const response = await this.request('/api/admin/campaigns');
      if (!response.ok) throw new Error('Campaign list unavailable');
      const payload = (await response.json()) as { campaigns?: CampaignSummary[] };
      if (!Array.isArray(payload.campaigns)) throw new Error('Missing campaign list');
      this.campaigns.set(payload.campaigns);
      const statuses = await this.request('/api/admin/generations');
      if (statuses.ok) {
        const generationPayload = (await statuses.json()) as RecoverableGenerationsResponse;
        this.generationStatuses.set(generationPayload.generations ?? []);
      }
    } catch {
      this.listError.set('Campaigns could not be loaded. Try again.');
    } finally {
      this.listLoading.set(false);
    }
  }

  private async refreshOpenCampaign(
    campaignId: string,
    generationSequence?: number,
    status?: GenerationStatus,
  ): Promise<void> {
    const response = await this.request(`/api/admin/campaigns/${campaignId}`);
    if (generationSequence !== undefined && generationSequence !== this.generationPollSequence) {
      return;
    }
    if (!response.ok) return;
    const payload = (await response.json()) as CampaignResponse;
    if (generationSequence !== undefined && generationSequence !== this.generationPollSequence) {
      return;
    }
    if (!payload.campaign) return;
    const next = payload.campaign;
    if (status?.refinement) {
      const refinement = status.refinement;
      if (status.state === 'succeeded' && next.refinement?.runId === refinement.runId) {
        this.copyEdits.update((edits) =>
          Object.fromEntries(
            Object.entries(edits).filter(
              ([, edit]) =>
                edit.campaignId !== next.id ||
                (refinement.language === 'sv' && edit.language === 'en'),
            ),
          ),
        );
      } else if (status.state !== 'succeeded') {
        const copy = next.copy[refinement.language];
        if (copy) next.copy[refinement.language] = { ...copy, ...refinement.draft };
      }
    }
    // A status poll or revision conflict must not replace the user's pending wording.
    for (const edit of Object.values(this.copyEdits())) {
      if (edit.campaignId !== next.id || edit.state === 'saved') continue;
      const copy = next.copy[edit.language];
      if (copy) next.copy[edit.language] = { ...copy, [edit.fieldId]: edit.value };
    }
    this.campaign.set(next);
    this.generationRevision.set(payload.campaign.revision);
    this.setCopyWarning(payload.campaign);
  }

  private setCopyWarning(campaign: Campaign): void {
    const missing = (['en', 'sv'] as const).filter((language) => !campaign.copy[language]);
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
      return 'Campaign generation is unavailable. Your saved campaigns are still accessible.';
    }
    if (status === 504) {
      return 'The campaign took too long to create. Try again.';
    }
    return 'The campaign could not be created right now. Try again.';
  }

  private findPublicStylesheet(): HTMLLinkElement | undefined {
    return Array.from(
      this.document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
    ).find((link) => link.getAttribute('href')?.startsWith('/assets/styles/styles.css'));
  }

  private originalPublicStylesheetMedia(): string | null {
    const media = this.publicStylesheet?.getAttribute('media') ?? null;
    return media === 'not all' ? null : media;
  }

  private resetStudio(): void {
    this.view.set('list');
    this.section.set('copy');
    this.copyEdits.set({});
    this.generationStatuses.set([]);
    this.campaigns.set([]);
    this.campaign.set(undefined);
    this.roughIdea.set('');
    this.roughIdeaValidation.set(undefined);
    this.generationError.set('');
    this.copyError.set('');
    this.generating.set(false);
    this.refining.set(false);
    this.stepStatus.set(idleSteps());
    this.generationCampaignId.set('');
    this.generationRevision.set(0);
    this.retryStage.set(undefined);
    this.language.set(DEFAULT_LANGUAGE);
    this.copiedId.set('');
    this.selectedFieldId.set('headline');
    this.inspectedPrompt.set(undefined);
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

function generationStepState(index: number, selected: number, state: GenerationState): StepStatus {
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
  return new Promise((resolve) => setTimeout(resolve, 1_000));
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

/** Saved guidance may contain budget clauses; the field meter owns that information. */
function sidebarGuidance(value: string): string {
  return value
    .split(/(?<=[.!?;])\s+/u)
    .filter((clause) => !/\b(?:characters?|chars?)\b/iu.test(clause))
    .join(' ')
    .trim()
    .replace(/;$/u, '.');
}

/** Code points, matching how the server counts against each budget. */
function characterCount(value: string): number {
  return [...value].length;
}
