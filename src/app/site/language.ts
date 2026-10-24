import { isPublicLanguage } from '../../../server/src/public-routes';
export {
  PUBLIC_LANGUAGES as SUPPORTED_LANGUAGES,
  LANGUAGE_NAMES,
  publicLanguageFromPath as languageFromPath,
} from '../../../server/src/public-routes';
import type { PublicLanguage } from '../../../server/src/public-routes';
export type SiteLanguage = PublicLanguage;

/** Angular inlines $localize.locale for each independently prerendered locale. */
export function activeLanguage(): SiteLanguage {
  const locale = $localize.locale?.split('-')[0];
  return isPublicLanguage(locale) ? locale : 'en';
}
export function languageBase(language: SiteLanguage): string {
  return language === 'sv' ? '/' : `/${language}/`;
}
