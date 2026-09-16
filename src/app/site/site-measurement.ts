import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';
import { PUBLIC_CANONICAL_PATHS } from '../../../server/src/public-routes';

type Preference = 'unset' | 'allowed' | 'denied';
type EventName =
  | 'page_view'
  | 'package_comparison_view'
  | 'package_interest'
  | 'enquiry_start'
  | 'generate_lead'
  | 'enquiry_error';
type EventContext = {
  packageId?: string;
  service?: string;
  error?: 'validation' | 'rate_limit' | 'unconfirmed';
};
type MeasurementWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  'ga-disable-G-E1BFSP43WZ'?: boolean;
};
const KEY = 'fp-analytics-consent-v1';
// Existing public GA4 property. Advertising tags are intentionally not activated by analytics consent.
const PROPERTY = 'G-E1BFSP43WZ';
// The existing property's automatic form/history/user-data collection must be disabled
// and actual payloads verified before enabling its production transport.
const GOOGLE_COLLECTION_REVIEWED: boolean = false;
const paths = new Set(PUBLIC_CANONICAL_PATHS);

/** Optional public-site measurement. No requests, cookies or visit storage before opt-in. */
@Injectable({ providedIn: 'root' })
export class SiteMeasurement {
  private readonly document = inject(DOCUMENT);
  readonly preference = signal<Preference>('unset');
  readonly available = signal(false);
  private initialized = false;
  private configured = false;
  private readonly once = new Set<string>();
  private landingPath = '';
  private source = 'direct';

  initialize(): void {
    if (this.initialized || !this.document.defaultView) return;
    this.initialized = true;
    const hostname = this.document.defaultView.location.hostname;
    this.available.set(
      ['localhost', '127.0.0.1', '[::1]'].includes(hostname) ||
        (hostname === 'faunapoolen.se' && GOOGLE_COLLECTION_REVIEWED),
    );
    if (!this.available()) return;
    try {
      const stored = this.document.defaultView.localStorage.getItem(KEY);
      if (stored === 'allowed' || stored === 'denied') this.preference.set(stored);
    } catch {
      /* Measurement remains optional when storage is unavailable. */
    }
    if (this.preference() === 'allowed') this.enable();
  }

  choose(value: 'allowed' | 'denied'): void {
    if (!this.available()) return;
    this.preference.set(value);
    const browser = this.document.defaultView as MeasurementWindow | null;
    if (!browser) return;
    try {
      browser.localStorage.setItem(KEY, value);
    } catch {
      /* Choice still applies to this page. */
    }
    if (value === 'allowed') {
      this.enable();
      this.track('page_view');
    } else {
      browser['ga-disable-G-E1BFSP43WZ'] = true;
      browser.gtag?.('consent', 'update', {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      });
      this.once.clear();
      this.landingPath = '';
      this.source = 'direct';
      try {
        browser.sessionStorage.removeItem('fp-analytics-visit');
      } catch {
        /* Optional storage. */
      }
      for (const cookie of this.document.cookie.split(';')) {
        const name = cookie.split('=')[0].trim();
        if (!/^_ga(?:_|$)/.test(name)) continue;
        for (const domain of ['', '; domain=faunapoolen.se', '; domain=.faunapoolen.se']) {
          this.document.cookie = `${name}=; max-age=0; path=/${domain}; SameSite=Lax`;
        }
      }
    }
  }

  private publicPath(): string | undefined {
    const raw = this.document.defaultView?.location.pathname;
    if (!raw) return undefined;
    const path = paths.has(raw) ? raw : raw + '/';
    return paths.has(path) ? path : undefined;
  }

  private enable(): void {
    const browser = this.document.defaultView as MeasurementWindow | null;
    const path = this.publicPath();
    if (!browser || !path) return;
    browser['ga-disable-G-E1BFSP43WZ'] = false;
    if (!this.landingPath) {
      this.landingPath = path;
      try {
        const referrer = new URL(this.document.referrer);
        this.source =
          referrer.host === browser.location.host
            ? 'internal'
            : /(^|\.)google\.[a-z.]+$|(^|\.)bing\.com$|(^|\.)duckduckgo\.com$/.test(
                  referrer.hostname,
                )
              ? 'search'
              : 'referral';
      } catch {
        this.source = 'direct';
      }
      try {
        const previous = JSON.parse(browser.sessionStorage.getItem('fp-analytics-visit') ?? 'null');
        if (
          previous &&
          paths.has(previous.path) &&
          ['direct', 'internal', 'search', 'referral'].includes(previous.source)
        ) {
          this.landingPath = previous.path;
          this.source = previous.source;
        }
        browser.sessionStorage.setItem(
          'fp-analytics-visit',
          JSON.stringify({ path: this.landingPath, source: this.source }),
        );
      } catch {
        /* No tracking depends on storage working. */
      }
    }
    // Local and isolated verification exposes the same event contract without contacting Google.
    if (browser.location.hostname !== 'faunapoolen.se' || !GOOGLE_COLLECTION_REVIEWED) return;
    if (this.configured) {
      browser.gtag?.('consent', 'update', { analytics_storage: 'granted' });
      return;
    }
    this.configured = true;
    browser.dataLayer ??= [];
    browser.gtag = function () {
      browser.dataLayer!.push(arguments);
    };
    browser.gtag('consent', 'default', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    browser.gtag('js', new Date());
    browser.gtag('consent', 'update', { analytics_storage: 'granted' });
    browser.gtag('config', PROPERTY, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_expires: 15552000,
      page_location: 'https://faunapoolen.se' + path,
      page_referrer: '',
    });
    const script = this.document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + PROPERTY;
    this.document.head.appendChild(script);
  }

  track(name: EventName, context: EventContext = {}): void {
    const browser = this.document.defaultView as MeasurementWindow | null;
    const path = this.publicPath();
    if (!browser || !path || !this.available() || this.preference() !== 'allowed') return;
    this.enable();
    const key = `${name}:${path}`;
    if (['page_view', 'package_comparison_view', 'enquiry_start'].includes(name)) {
      if (this.once.has(key)) return;
      this.once.add(key);
    }
    const data = {
      page_location: 'https://faunapoolen.se' + path,
      page_referrer: '',
      page_title: this.document.title,
      language: this.document.documentElement.lang,
      landing_path: this.landingPath,
      source_group: this.source,
      ...(context.packageId && ['glade', 'summer', 'horizon', 'unsure'].includes(context.packageId)
        ? { package_id: context.packageId }
        : {}),
      ...(context.service && ['pool', 'pond', 'stream', 'unsure'].includes(context.service)
        ? { service: context.service }
        : {}),
      ...(context.error ? { error_category: context.error } : {}),
    };
    browser.dispatchEvent(
      new CustomEvent('faunapoolen:measurement', { detail: { name, ...data } }),
    );
    if (browser.location.hostname === 'faunapoolen.se' && GOOGLE_COLLECTION_REVIEWED)
      browser.gtag?.('event', name, data);
  }
}
