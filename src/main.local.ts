import { loadTranslations } from '@angular/localize';
import { languageFromPath } from './app/site/language';

// Angular's runtime translation API loads the same catalogues as production before any
// application messages are evaluated. Switching languages is a document navigation.
async function start(): Promise<void> {
  const language = languageFromPath(window.location.pathname);
  $localize.locale = language;
  if (language === 'sv') loadTranslations((await import('./locale/messages.sv.json')).translations);
  if (language === 'da') loadTranslations((await import('./locale/messages.da.json')).translations);
  if (language === 'it') loadTranslations((await import('./locale/messages.it.json')).translations);
  if (language === 'es') loadTranslations((await import('./locale/messages.es.json')).translations);
  if (language === 'pt') loadTranslations((await import('./locale/messages.pt.json')).translations);
  if (language === 'de') loadTranslations((await import('./locale/messages.de.json')).translations);
  if (language === 'pl') loadTranslations((await import('./locale/messages.pl.json')).translations);
  const { bootstrap } = await import('./bootstrap');
  await bootstrap();
}
void start().catch((error) => console.error(error));
