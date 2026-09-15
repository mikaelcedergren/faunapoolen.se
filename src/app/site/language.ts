export const SUPPORTED_LANGUAGES = ['en', 'sv', 'da'] as const;
export type SiteLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const LANGUAGE_NAMES = { en: 'English', sv: 'Svenska', da: 'Dansk' } as const;

/** Angular inlines $localize.locale for each independently prerendered locale. */
export function activeLanguage(): SiteLanguage {
  const locale = $localize.locale?.split('-')[0];
  return locale === 'sv' || locale === 'da' ? locale : 'en';
}

export function languageFromPath(path: string): SiteLanguage {
  if (/^\/en(?:\/|$)/.test(path)) return 'en';
  if (/^\/da(?:\/|$)/.test(path)) return 'da';
  return 'sv';
}

export function preferredLanguage(languages: readonly string[]): SiteLanguage {
  for (const value of languages) {
    const language = value.toLowerCase().split(/[-_]/)[0];
    if (language === 'en' || language === 'sv' || language === 'da') return language;
  }
  return 'en';
}

export function languageBase(language: SiteLanguage): string {
  return language === 'sv' ? '/' : `/${language}/`;
}
