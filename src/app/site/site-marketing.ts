import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router } from '@angular/router';
import { PUBLIC_CANONICAL_PATHS } from '../../../server/src/public-routes';
import { MetaPixel, type MetaEvent } from './meta-pixel';

const KEY = 'fp-marketing-consent-v1';
const paths = new Set(PUBLIC_CANONICAL_PATHS);

@Injectable({ providedIn: 'root' })
export class SiteMarketing {
  private readonly document = inject(DOCUMENT);
  private readonly pixel = new MetaPixel(this.document);
  readonly preference = signal<'unset' | 'allowed' | 'denied'>('unset');
  readonly available = signal(false);
  private initialized = false;
  private lastPage = '';

  constructor() {
    inject(Router)
      .events.pipe(takeUntilDestroyed())
      .subscribe((event) => {
        if (!(event instanceof NavigationStart)) return;
        const path = event.url.split(/[?#]/, 1)[0];
        if (paths.has(path) || paths.has(path + '/')) return;
        this.lastPage = '';
        this.pixel.revoke();
      });
  }

  initialize(): void {
    const browser = this.document.defaultView;
    if (this.initialized || !browser) return;
    this.initialized = true;
    this.available.set(
      browser.location.origin === 'https://faunapoolen.se' ||
        ['localhost', '127.0.0.1', '[::1]'].includes(browser.location.hostname),
    );
    if (!this.available()) return;
    try {
      const value = browser.localStorage.getItem(KEY);
      if (value === 'allowed' || value === 'denied') this.preference.set(value);
    } catch {
      /* Without storage, consent applies only to this document. */
    }
    browser.addEventListener('storage', (event) => {
      if (event.key !== KEY && event.key !== null) return;
      // Another tab may withdraw consent; it never silently grants this tab permission.
      if (event.newValue !== 'allowed') this.choose('denied');
    });
  }

  choose(value: 'allowed' | 'denied'): void {
    if (!this.available()) return;
    this.preference.set(value);
    try {
      this.document.defaultView?.localStorage.setItem(KEY, value);
    } catch {
      /* Optional storage. */
    }
    if (value === 'allowed') this.track('PageView');
    else {
      this.lastPage = '';
      this.pixel.revoke();
    }
  }

  track(name: MetaEvent): void {
    const browser = this.document.defaultView;
    if (!browser || !this.available() || this.preference() !== 'allowed') return;
    const raw = browser.location.pathname;
    const path = paths.has(raw) ? raw : raw + '/';
    if (!paths.has(path)) {
      this.pixel.revoke();
      return;
    }
    if (name === 'PageView') {
      if (this.lastPage === path) return;
      this.lastPage = path;
    }
    // Local proof has no Meta SDK, cookies, or network traffic.
    browser.dispatchEvent(
      new CustomEvent('faunapoolen:marketing', {
        detail: { name, path },
      }),
    );
    this.pixel.send(name);
  }
}
