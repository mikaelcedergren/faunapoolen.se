import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import {
  CxAlertComponent,
  CxButtonComponent,
  CxButtonGroupComponent,
  CxCheckboxComponent,
  CxDialogComponent,
  CxFileUploadComponent,
  CxInlineComponent,
  CxSidebarLayoutComponent,
  CxSliderComponent,
  CxStackComponent,
  CxStateMessageComponent,
  CxTableComponent,
  CxTabsComponent,
  CxTextAreaComponent,
  CxTextFieldComponent,
  type CxButtonGroupOption,
  type CxFileUpload,
  type CxFileUploadValue,
  type CxTableColumn,
  type CxTableRow,
} from '@mikaelcedergren/cx-framework';
import {
  SOCIAL_PLATFORMS,
  SOCIAL_LABELS,
  SOCIAL_TEXT_LIMITS,
  SOCIAL_MAX_MEDIA_BYTES,
  SOCIAL_DIMENSIONS,
  socialIssues,
  socialTextLength,
  socialVariant,
  type SocialAdaptation,
  type SocialFormat,
  type SocialPlatform,
  type SocialPost,
  type SocialPostInput,
  type SocialPostSummary,
  type SocialVariant,
} from '../../../../server/src/social-contracts';
@Component({
  selector: 'fp-social-posts',
  imports: [
    CxAlertComponent,
    CxButtonComponent,
    CxButtonGroupComponent,
    CxCheckboxComponent,
    CxDialogComponent,
    CxFileUploadComponent,
    CxInlineComponent,
    CxSidebarLayoutComponent,
    CxSliderComponent,
    CxStackComponent,
    CxStateMessageComponent,
    CxTableComponent,
    CxTabsComponent,
    CxTextAreaComponent,
    CxTextFieldComponent,
  ],
  templateUrl: './social-posts.component.html',
  styleUrl: './social-posts.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SocialPostsComponent {
  readonly sessionExpired = output<void>();
  protected readonly labels = SOCIAL_LABELS;
  protected readonly platforms = SOCIAL_PLATFORMS;
  protected readonly maxMedia = SOCIAL_MAX_MEDIA_BYTES;
  protected readonly list = signal<SocialPostSummary[]>([]);
  protected readonly post = signal<SocialPost | null>(null);
  protected readonly draft = signal<SocialPostInput | null>(null);
  protected readonly filter = signal('pending');
  protected readonly source = signal(false);
  protected readonly selected = signal<SocialPlatform>('facebook');
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly busy = signal(false);
  protected readonly loading = signal(true);
  protected readonly aiEnabled = signal(false);
  protected readonly anyPublished = computed(
    () => this.draft()?.variants.some((v) => v.published) ?? false,
  );
  protected readonly adaptation = signal<SocialAdaptation | null>(null);
  protected readonly dirty = signal(false);
  protected readonly saving = signal(false);
  protected readonly adjust = signal(false);
  protected readonly deleteOpen = signal(false);
  protected readonly leaveOpen = signal(false);
  protected readonly file = signal<File | null>(null);
  protected readonly imagePreview = signal('');
  protected readonly filters: CxButtonGroupOption[] = [
    { id: 'pending', label: 'Pending' },
    { id: 'published', label: 'Published' },
  ];
  protected readonly fits: CxButtonGroupOption[] = [
    { id: 'contain', label: 'Fit' },
    { id: 'cover', label: 'Crop' },
  ];
  protected readonly columns: CxTableColumn[] = [
    { id: 'name', label: 'Post', key: true, size: 'flex', hideable: false, pinnable: false },
    { id: 'platforms', label: 'Platforms', size: 'content', hideable: false, pinnable: false },
  ];
  protected readonly rows = computed<CxTableRow[]>(() =>
    this.list()
      .filter(
        (p) => (p.platforms.length === p.published.length) === (this.filter() === 'published'),
      )
      .map((p) => ({
        id: p.id,
        cells: {
          name: { kind: 'text', value: p.name, strong: true },
          platforms: {
            kind: 'text',
            value: p.platforms
              .map((k) => this.labels[k] + (p.published.includes(k) ? ' ✓' : ''))
              .join(' · '),
          },
        },
      })),
  );
  protected readonly tabs = computed(
    () =>
      this.draft()?.variants.map((v) => ({
        id: v.platform,
        label: this.labels[v.platform] + (v.published ? ' ✓' : ''),
      })) ?? [],
  );
  protected readonly variant = computed(() =>
    this.draft()?.variants.find((v) => v.platform === this.selected()),
  );
  protected readonly issues = computed(() =>
    this.variant() ? socialIssues(this.variant()!, this.post()?.media ?? null) : [],
  );
  protected readonly files = computed<readonly CxFileUploadValue[]>(() =>
    this.file()
      ? [{ name: this.file()!.name, file: this.file()! }]
      : this.post()?.media
        ? [{ name: this.post()!.media!.name }]
        : [],
  );
  protected readonly mediaUrl = computed(() =>
    this.post()?.media
      ? `/api/admin/social-posts/${this.post()!.id}/media?r=${this.post()!.media!.sha256}`
      : '',
  );
  protected readonly ratio = computed(() => {
    const d = SOCIAL_DIMENSIONS[this.variant()?.format ?? 'square'];
    return `${d[0]} / ${d[1]}`;
  });
  protected readonly formats = computed<CxButtonGroupOption[]>(() =>
    this.selected() === 'youtube'
      ? [
          { id: 'landscape', label: 'Video · 16:9' },
          { id: 'vertical', label: 'Short · 9:16' },
        ]
      : this.post()?.media?.kind === 'video'
        ? [
            { id: 'square', label: 'Square' },
            { id: 'landscape', label: 'Landscape' },
            { id: 'vertical', label: 'Vertical' },
          ]
        : [
            { id: 'square', label: 'Square' },
            { id: 'portrait', label: 'Portrait' },
            { id: 'landscape', label: 'Landscape' },
          ],
  );
  private readonly lifetime = new AbortController();
  private timer?: ReturnType<typeof setTimeout>;
  private pollTimer?: ReturnType<typeof setTimeout>;
  private savePromise?: Promise<boolean>;
  private leaveDecision?: (allow: boolean) => void;
  private newId = '';
  private previewSequence = 0;
  private readonly protect = (e: BeforeUnloadEvent) => {
    if (this.dirty() || this.file() || this.busy()) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  constructor() {
    afterNextRender(() => {
      window.addEventListener('beforeunload', this.protect);
      void this.reload();
    });
    inject(DestroyRef).onDestroy(() => {
      this.lifetime.abort();
      clearTimeout(this.timer);
      clearTimeout(this.pollTimer);
      this.leaveDecision?.(false);
      if (typeof window !== 'undefined') window.removeEventListener('beforeunload', this.protect);
    });
  }
  private async request<T>(url: string, init: RequestInit = {}, timeout = 20000): Promise<T> {
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(timeout)]),
    });
    if (res.status === 401) {
      this.sessionExpired.emit();
      throw Error('Your session expired. Sign in to continue.');
    }
    if (!res.ok) {
      let message = 'The request could not be completed. Your edits are still here.';
      try {
        const data = await res.json();
        message = data.error?.message ?? data.message ?? message;
      } catch {}
      throw Error(message);
    }
    return (await res.json()) as T;
  }
  private json(method: string, value: unknown): RequestInit {
    return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) };
  }
  protected async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const data = await this.request<{ posts: SocialPostSummary[]; aiEnabled: boolean }>(
        '/api/admin/social-posts',
      );
      this.list.set(data.posts);
      this.aiEnabled.set(data.aiEnabled);
    } catch (e) {
      this.fail(e);
    } finally {
      this.loading.set(false);
    }
  }
  private fail(e: unknown): void {
    if (!this.lifetime.signal.aborted)
      this.error.set(e instanceof Error ? e.message : 'The request failed. Try again.');
  }
  protected add(): void {
    this.newId = crypto.randomUUID();
    this.post.set(null);
    this.draft.set({ name: '', text: '', variants: [socialVariant('facebook', '', '', false)] });
    this.source.set(true);
    this.dirty.set(false);
    this.file.set(null);
    this.adaptation.set(null);
    this.error.set('');
    this.notice.set('');
  }
  protected async open(id: string): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const data = await this.request<{ post: SocialPost; adaptation: SocialAdaptation | null }>(
        '/api/admin/social-posts/' + id,
      );
      this.post.set(data.post);
      this.draft.set(structuredClone(this.input(data.post)));
      this.selected.set(data.post.variants[0]!.platform);
      this.source.set(false);
      this.dirty.set(false);
      this.adaptation.set(data.adaptation);
      this.adjust.set(false);
      this.notice.set('');
      this.file.set(null);
      void this.refreshPreview();
      if (data.adaptation?.state === 'pending') this.poll(data.adaptation.id);
    } catch (e) {
      this.fail(e);
    } finally {
      this.busy.set(false);
    }
  }
  private input(p: SocialPostInput): SocialPostInput {
    return { name: p.name, text: p.text, variants: p.variants };
  }
  protected update(field: 'name' | 'text', value: string): void {
    const d = this.draft();
    if (!d) return;
    this.draft.set({ ...d, [field]: value });
    this.changed();
  }
  protected chosen(platform: SocialPlatform): boolean {
    return !!this.draft()?.variants.some((v) => v.platform === platform);
  }
  protected choose(platform: SocialPlatform, on: boolean): void {
    const d = this.draft();
    if (!d) return;
    this.draft.set({
      ...d,
      variants: on
        ? [
            ...d.variants,
            socialVariant(
              platform,
              d.text,
              d.name,
              this.post()?.media?.kind === 'video' || !!this.file()?.type.startsWith('video/'),
            ),
          ].sort((a, b) => this.platforms.indexOf(a.platform) - this.platforms.indexOf(b.platform))
        : d.variants.filter((v) => v.platform !== platform),
    });
    this.changed();
  }
  protected edit(patch: Partial<SocialVariant>): void {
    const d = this.draft();
    if (!d) return;
    this.draft.set({
      ...d,
      variants: d.variants.map((v) => (v.platform === this.selected() ? { ...v, ...patch } : v)),
    });
    this.changed();
    void this.refreshPreview();
  }
  protected select(id: string): void {
    this.selected.set(id as SocialPlatform);
    this.adjust.set(false);
    this.notice.set('');
    void this.refreshPreview();
  }
  protected format(id: string): void {
    this.edit({ format: id as SocialFormat });
  }
  protected fit(id: string): void {
    this.edit({ fit: id as 'contain' | 'cover' });
  }
  protected count(): string {
    const v = this.variant();
    return v
      ? `${socialTextLength(v.platform, v.text).toLocaleString('en-GB')} / ${SOCIAL_TEXT_LIMITS[v.platform].toLocaleString('en-GB')} ${v.platform === 'youtube' ? 'UTF-8 bytes' : v.platform === 'facebook' ? 'characters · tool limit' : 'characters'}`
      : '';
  }
  protected async upload(event: CxFileUpload): Promise<void> {
    const file = event.files[0]?.file;
    if (file) {
      this.file.set(file);
      this.dirty.set(true);
    } else if (!event.files.length) {
      this.file.set(null);
      if (this.post()?.media) {
        this.busy.set(true);
        try {
          const data = await this.request<{ post: SocialPost }>(
            `/api/admin/social-posts/${this.post()!.id}/media`,
            { method: 'DELETE', headers: { 'If-Match': String(this.post()!.revision) } },
          );
          this.post.set(data.post);
        } catch (e) {
          this.fail(e);
        } finally {
          this.busy.set(false);
        }
      }
    }
  }
  private changed(): void {
    this.dirty.set(true);
    this.notice.set('');
    clearTimeout(this.timer);
    if (this.post()) this.timer = setTimeout(() => void this.save(), 700);
  }
  protected async prepare(): Promise<void> {
    const d = this.draft();
    if (!d?.text.trim()) {
      this.error.set('Write the post content first.');
      return;
    }
    if (!d.variants.length) {
      this.error.set('Choose at least one platform.');
      return;
    }
    if (!d.name.trim()) this.draft.set({ ...d, name: d.text.trim().split('\n')[0]!.slice(0, 80) });
    if (!this.post()) {
      const current = this.draft()!;
      this.draft.set({
        ...current,
        variants: current.variants.map((v) =>
          socialVariant(
            v.platform,
            current.text,
            current.name,
            !!this.file()?.type.startsWith('video/'),
          ),
        ),
      });
    }
    if (await this.save()) {
      this.source.set(false);
      if (!this.variant()) this.selected.set(this.draft()!.variants[0]!.platform);
      void this.refreshPreview();
    }
  }
  protected save(): Promise<boolean> {
    clearTimeout(this.timer);
    if (this.savePromise) return this.savePromise;
    this.savePromise = this.saveLoop().finally(() => (this.savePromise = undefined));
    return this.savePromise;
  }
  private async saveLoop(): Promise<boolean> {
    if (!this.draft()) return true;
    if (!this.draft()!.name.trim() || !this.draft()!.text.trim() || !this.draft()!.variants.length)
      return false;
    this.saving.set(true);
    this.error.set('');
    try {
      do {
        const snapshot = structuredClone(this.draft()!),
          saved = this.post();
        if (!saved || this.dirty()) {
          let result: { post: SocialPost };
          try {
            result = await this.request<{ post: SocialPost }>(
              '/api/admin/social-posts' + (saved ? '/' + saved.id : ''),
              this.json(
                saved ? 'PATCH' : 'POST',
                saved
                  ? { expectedRevision: saved.revision, post: snapshot }
                  : { id: this.newId, post: snapshot },
              ),
            );
          } catch (error) {
            // A lost response may follow a committed save. Confirm its exact content before retrying.
            const confirmed = await this.request<{ post: SocialPost }>(
              `/api/admin/social-posts/${saved?.id ?? this.newId}`,
            ).catch(() => null);
            if (
              !confirmed ||
              JSON.stringify(this.input(confirmed.post)) !== JSON.stringify(snapshot)
            )
              throw error;
            result = confirmed;
          }
          this.post.set(result.post);
          this.dirty.set(JSON.stringify(snapshot) !== JSON.stringify(this.draft()));
        }
        const file = this.file();
        if (file) {
          const p = this.post()!;
          const result = await this.request<{ post: SocialPost }>(
            `/api/admin/social-posts/${p.id}/media`,
            {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/octet-stream',
                'If-Match': String(p.revision),
                'X-File-Name': encodeURIComponent(file.name),
              },
              body: file,
            },
            60000,
          );
          this.post.set(result.post);
          if (this.file() === file) this.file.set(null);
        }
      } while (this.dirty() && !this.lifetime.signal.aborted);
      return true;
    } catch (e) {
      this.dirty.set(true);
      this.fail(e);
      return false;
    } finally {
      this.saving.set(false);
    }
  }
  public async canLeave(): Promise<boolean> {
    if (this.busy()) return false;
    if (this.post() && (await this.save())) return true;
    if (!this.dirty() && !this.file()) return true;
    this.leaveDecision?.(false);
    this.leaveOpen.set(true);
    return new Promise((resolve) => (this.leaveDecision = resolve));
  }
  protected decideLeave(allow: boolean): void {
    this.leaveOpen.set(false);
    this.leaveDecision?.(allow);
    this.leaveDecision = undefined;
    if (allow) {
      this.dirty.set(false);
      this.file.set(null);
    }
  }
  protected async back(): Promise<void> {
    if (!(await this.canLeave())) return;
    this.draft.set(null);
    this.post.set(null);
    clearTimeout(this.pollTimer);
    await this.reload();
  }
  protected async remove(): Promise<void> {
    if (!this.post()) return;
    this.busy.set(true);
    try {
      await this.request('/api/admin/social-posts/' + this.post()!.id, {
        method: 'DELETE',
        headers: { 'If-Match': String(this.post()!.revision) },
      });
      this.deleteOpen.set(false);
      this.dirty.set(false);
      this.file.set(null);
      this.draft.set(null);
      this.post.set(null);
      clearTimeout(this.timer);
      clearTimeout(this.pollTimer);
      await this.reload();
    } catch (e) {
      this.fail(e);
    } finally {
      this.busy.set(false);
    }
  }
  protected async copy(): Promise<void> {
    try {
      const v = this.variant();
      if (v) {
        await navigator.clipboard.writeText(
          v.platform === 'youtube' ? `${v.title}\n\n${v.text}` : v.text,
        );
        this.notice.set('Text copied.');
      }
    } catch {
      this.error.set('Copy was blocked by the browser. Select and copy the text above.');
    }
  }
  protected async download(): Promise<void> {
    if (!(await this.save())) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const p = this.post()!,
        v = this.variant()!;
      const res = await fetch(`/api/admin/social-posts/${p.id}/export/${v.platform}`, {
        ...this.json('POST', { expectedRevision: p.revision }),
        signal: AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(200000)]),
      });
      if (!res.ok) {
        const data = await res.json();
        throw Error(data.error?.message ?? 'The media could not be prepared.');
      }
      const blob = await res.blob(),
        url = URL.createObjectURL(blob),
        a = document.createElement('a');
      a.href = url;
      a.download = `${v.platform}-${p.name.replace(/[^a-z0-9_-]/gi, '-').slice(0, 60)}.${p.media?.kind === 'video' ? 'mp4' : 'jpg'}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.notice.set('Media downloaded.');
    } catch (e) {
      this.fail(e);
    } finally {
      this.busy.set(false);
    }
  }
  protected async adapt(): Promise<void> {
    if (!(await this.save())) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const result = await this.request<{ adaptation: SocialAdaptation }>(
        `/api/admin/social-posts/${this.post()!.id}/adapt`,
        this.json('POST', { expectedRevision: this.post()!.revision }),
      );
      this.adaptation.set(result.adaptation);
      if (result.adaptation.state === 'pending') this.poll(result.adaptation.id);
    } catch (e) {
      this.fail(e);
    } finally {
      this.busy.set(false);
    }
  }
  private poll(id: string): void {
    clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(async () => {
      try {
        const r = await this.request<{ adaptation: SocialAdaptation }>(
          '/api/admin/social-adaptations/' + id,
        );
        this.adaptation.set(r.adaptation);
        if (r.adaptation.state === 'pending') this.poll(id);
      } catch (e) {
        this.fail(e);
      }
    }, 1500);
  }
  protected suggestion(): { text: string; title: string } | undefined {
    return this.adaptation()?.variants?.find((v) => v.platform === this.selected());
  }
  protected applySuggestion(): void {
    const suggestion = this.suggestion();
    if (suggestion) {
      this.edit(suggestion);
      this.adaptation.update((a) =>
        a
          ? { ...a, variants: a.variants?.filter((v) => v.platform !== this.selected()) ?? null }
          : null,
      );
    }
  }
  protected async published(on: boolean): Promise<void> {
    if (on && this.issues().length) return;
    this.adjust.set(false);
    this.edit({ published: on });
    await this.save();
  }
  protected trim(range: readonly [number, number]): void {
    this.edit({ start: range[0], end: range[1] });
  }
  protected previewTime(event: Event): void {
    const video = event.target as HTMLVideoElement,
      v = this.variant();
    if (v && (video.currentTime < v.start || video.currentTime > (v.end ?? video.duration)))
      video.currentTime = v.start;
  }
  private async refreshPreview(): Promise<void> {
    const seq = ++this.previewSequence,
      url = this.mediaUrl(),
      v = this.variant();
    this.imagePreview.set('');
    if (!url || !v || this.post()?.media?.kind !== 'image') return;
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
      if (seq !== this.previewSequence) return;
      const [w, h] = SOCIAL_DIMENSIONS[v.format],
        canvas = document.createElement('canvas');
      canvas.width = 540;
      canvas.height = Math.round((540 * h) / w);
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const scale =
        v.fit === 'cover'
          ? Math.max(canvas.width / img.width, canvas.height / img.height)
          : Math.min(canvas.width / img.width, canvas.height / img.height);
      const width = img.width * scale,
        height = img.height * scale;
      ctx.drawImage(
        img,
        (canvas.width - width) * (v.fit === 'cover' ? v.x / 100 : 0.5),
        (canvas.height - height) * (v.fit === 'cover' ? v.y / 100 : 0.5),
        width,
        height,
      );
      this.imagePreview.set(canvas.toDataURL('image/jpeg'));
    } catch {
      if (seq === this.previewSequence)
        this.error.set('The image preview could not be loaded. Reopen the post to try again.');
    }
  }
}
