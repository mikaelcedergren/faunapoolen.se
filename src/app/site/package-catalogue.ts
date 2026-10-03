import { afterNextRender, computed, Injectable, signal } from '@angular/core';
import type { PackageCatalogue } from '../../../server/src/package-contracts';
import { FAUNAPOOLEN_PACKAGES, type FaunapoolenPackage } from './content/faunapoolen-content';
import { activeLanguage } from './language';

/** The browser reads current prices. Prerendering never freezes an obsolete offer into HTML. */
@Injectable({ providedIn: 'root' })
export class PublicPackageCatalogue {
  readonly value = signal<PackageCatalogue | undefined>(undefined);
  readonly loading = signal(true);
  readonly error = signal(false);
  private readonly locale = activeLanguage();
  private readonly currency = new Intl.NumberFormat(this.locale, {
    style: 'currency',
    currency: 'SEK',
    maximumFractionDigits: 0,
  });
  readonly packages = computed<readonly FaunapoolenPackage[]>(() =>
    (this.value()?.packages ?? []).map((values) => ({
      ...FAUNAPOOLEN_PACKAGES.find((item) => item.id === values.id)!,
      id: values.id,
      name: values.titles[this.locale],
      price: values.price,
    })),
  );
  money(value: number): string {
    return this.currency.format(value);
  }
  price(item: FaunapoolenPackage): string {
    return this.money(item.price);
  }
  private pending?: Promise<void>;
  private loadVersion = 0;
  constructor() {
    afterNextRender(() => void this.reload());
  }
  acceptSaved(value: PackageCatalogue): void {
    // A read started before this save must not replace its newer values.
    this.loadVersion++;
    this.pending = undefined;
    this.value.set(value);
    this.loading.set(false);
    this.error.set(false);
  }
  reload(): Promise<void> {
    if (this.pending) return this.pending;
    const version = ++this.loadVersion;
    this.loading.set(true);
    this.error.set(false);
    this.pending = (async () => {
      try {
        const response = await fetch('/api/packages', {
          cache: 'no-store',
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw new Error('Packages unavailable');
        const value = (await response.json()) as PackageCatalogue;
        if (!Array.isArray(value.packages) || value.packages.length !== 3)
          throw new Error('Invalid packages');
        if (version === this.loadVersion) this.value.set(value);
      } catch {
        if (version === this.loadVersion) {
          this.value.set(undefined);
          this.error.set(true);
        }
      } finally {
        if (version === this.loadVersion) {
          this.loading.set(false);
          this.pending = undefined;
        }
      }
    })();
    return this.pending;
  }
}
