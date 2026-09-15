import { loadTranslations } from '@angular/localize';
import { languageFromPath } from './app/site/language';

// Angular's runtime translation API loads the same catalogues as production before any
// application messages are evaluated. Switching languages is a document navigation.
async function start(): Promise<void> {
  const language = languageFromPath(window.location.pathname);
  $localize.locale = language;
  if (language === 'sv') loadTranslations((await import('./locale/messages.sv.json')).translations);
  if (language === 'da') loadTranslations((await import('./locale/messages.da.json')).translations);
  const { bootstrap } = await import('./bootstrap');
  await bootstrap();
}
void start().catch((error) => console.error(error));
