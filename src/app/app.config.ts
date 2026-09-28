import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideClientHydration } from '@angular/platform-browser';
import { TitleStrategy, provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideCxKeyboardFocus } from '@mikaelcedergren/cx-framework';
import { routes } from './app.routes';
import { SeoTitleStrategy } from './shared/seo';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Keyboard-modality focus rings for the cx components on /admin. The framework requires this
    // once in application configuration; components must never install it themselves.
    provideCxKeyboardFocus(),
    // Hydrate (reuse) the prerendered DOM instead of re-rendering it, so the static scripts.js
    // (accordion, mobile menu, language switcher, sticky header) keeps working on the live nodes.
    provideClientHydration(),
    provideRouter(
      routes,
      withInMemoryScrolling({
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'enabled',
      }),
    ),
    { provide: TitleStrategy, useClass: SeoTitleStrategy },
  ],
};
