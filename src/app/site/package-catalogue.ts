import { afterNextRender, Injectable, signal } from '@angular/core';
import type { PackageCatalogue } from '../../../server/src/package-contracts';

/** The browser reads current prices. Prerendering never freezes an obsolete offer into HTML. */
@Injectable({ providedIn: 'root' })
export class PublicPackageCatalogue {
  readonly value = signal<PackageCatalogue | undefined>(undefined);
  readonly loading = signal(true);
  readonly error = signal(false);
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
