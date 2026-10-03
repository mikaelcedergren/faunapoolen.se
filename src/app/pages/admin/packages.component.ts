import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  output,
  signal,
} from '@angular/core';
import {
  CxAlertComponent,
  CxButtonComponent,
  CxDialogComponent,
  CxGridComponent,
  CxInlineComponent,
  CxNumberFieldComponent,
  CxStackComponent,
  CxStateMessageComponent,
  CxTextFieldComponent,
} from '@mikaelcedergren/cx-framework';
import type {
  PackageCatalogue,
  PackageLanguage,
  PackageValues,
} from '../../../../server/src/package-contracts';
import { PublicPackageCatalogue } from '../../site/package-catalogue';

@Component({
  selector: 'fp-packages',
  imports: [
    CxAlertComponent,
    CxButtonComponent,
    CxDialogComponent,
    CxGridComponent,
    CxInlineComponent,
    CxNumberFieldComponent,
    CxStackComponent,
    CxStateMessageComponent,
    CxTextFieldComponent,
  ],
  templateUrl: './packages.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PackagesComponent {
  readonly sessionExpired = output<void>();
  private readonly publicCatalogue = inject(PublicPackageCatalogue);
  protected readonly saved = signal<PackageCatalogue | undefined>(undefined);
  protected readonly draft = signal<PackageValues[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly conflict = signal(false);
  protected readonly savedNotice = signal(false);
  protected readonly leaveOpen = signal(false);
  protected readonly attempted = signal(false);
  protected readonly languages: { id: PackageLanguage; label: string }[] = [
    { id: 'en', label: 'English title' },
    { id: 'sv', label: 'Swedish title' },
    { id: 'da', label: 'Danish title' },
  ];
  readonly dirty = computed(
    () => !!this.saved() && JSON.stringify(this.saved()!.packages) !== JSON.stringify(this.draft()),
  );
  private leaveDecision?: (allow: boolean) => void;
  private readonly abort = new AbortController();
  private readonly protect = (event: BeforeUnloadEvent) => {
    if (this.dirty() || this.saving()) {
      event.preventDefault();
      event.returnValue = '';
    }
  };
  constructor() {
    afterNextRender(() => {
      window.addEventListener('beforeunload', this.protect);
      void this.load();
    });
    inject(DestroyRef).onDestroy(() => {
      this.abort.abort();
      if (typeof window !== 'undefined') window.removeEventListener('beforeunload', this.protect);
      this.leaveDecision?.(false);
    });
  }
  protected titleError(value: string): string | undefined {
    return !value.trim() || value.trim().length > 80 || /[\u0000-\u001f\u007f]/u.test(value)
      ? 'Use 1–80 characters on one line.'
      : undefined;
  }
  protected priceError(price: number): string | undefined {
    return !Number.isSafeInteger(price) || price < 1 || price > 100000000
      ? 'Enter a whole SEK amount between 1 and 100,000,000.'
      : undefined;
  }
  protected updateTitle(index: number, locale: PackageLanguage, title: string): void {
    this.draft.update((items) =>
      items.map((item, i) =>
        i === index ? { ...item, titles: { ...item.titles, [locale]: title } } : item,
      ),
    );
    this.savedNotice.set(false);
  }
  protected updatePrice(index: number, price: number | undefined): void {
    this.draft.update((items) =>
      items.map((item, i) => (i === index ? { ...item, price: price ?? 0 } : item)),
    );
    this.savedNotice.set(false);
  }
  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const response = await fetch('/api/admin/packages', { signal: this.abort.signal });
      if (response.status === 401) {
        this.sessionExpired.emit();
        return;
      }
      if (!response.ok) throw new Error('Packages could not be loaded. Try again.');
      this.accept((await response.json()) as PackageCatalogue);
    } catch (error) {
      if (!this.abort.signal.aborted)
        this.error.set(error instanceof Error ? error.message : 'Packages could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }
  private accept(value: PackageCatalogue): void {
    this.saved.set(value);
    this.draft.set(structuredClone(value.packages));
    this.conflict.set(false);
    this.attempted.set(false);
  }
  protected async reload(): Promise<void> {
    if (await this.canLeave()) {
      this.savedNotice.set(false);
      await this.load();
    }
  }
  protected async save(): Promise<void> {
    if (this.saving() || !this.dirty()) return;
    this.attempted.set(true);
    if (
      this.draft().some(
        (p) =>
          this.priceError(p.price) || this.languages.some((l) => this.titleError(p.titles[l.id])),
      )
    )
      return;
    this.saving.set(true);
    this.error.set('');
    this.savedNotice.set(false);
    try {
      const response = await fetch('/api/admin/packages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        signal: this.abort.signal,
        body: JSON.stringify({ revision: this.saved()!.revision, packages: this.draft() }),
      });
      if (response.status === 401) {
        this.error.set(
          'Your session expired. Sign in again in another tab, then retry saving. Your edits are still here.',
        );
        return;
      }
      if (!response.ok) {
        this.conflict.set(response.status === 409);
        throw new Error(
          response.status === 409
            ? 'Packages changed elsewhere. Reload to see the latest values before editing again.'
            : 'Changes could not be saved. Your edits are still here. Try again.',
        );
      }
      const value = (await response.json()) as PackageCatalogue;
      this.accept(value);
      this.publicCatalogue.acceptSaved(value);
      this.savedNotice.set(true);
    } catch (error) {
      if (!this.abort.signal.aborted)
        this.error.set(error instanceof Error ? error.message : 'Changes could not be saved.');
    } finally {
      this.saving.set(false);
    }
  }
  async canLeave(): Promise<boolean> {
    if (this.saving()) return false;
    if (!this.dirty()) return true;
    this.leaveDecision?.(false);
    this.leaveOpen.set(true);
    return new Promise((resolve) => (this.leaveDecision = resolve));
  }
  protected decideLeave(allow: boolean): void {
    this.leaveOpen.set(false);
    this.leaveDecision?.(allow);
    this.leaveDecision = undefined;
  }
}
