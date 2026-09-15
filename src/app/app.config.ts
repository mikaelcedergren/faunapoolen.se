import {
  ApplicationConfig,
  inject,
  LOCALE_ID,
  provideAppInitializer,
  provideZoneChangeDetection,
} from '@angular/core';
import { APP_BASE_HREF, DOCUMENT, registerLocaleData, ViewportScroller } from '@angular/common';
import sv from '@angular/common/locales/sv';
import da from '@angular/common/locales/da';
import { activeLanguage, languageBase } from './site/language';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { TitleStrategy, provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideCxKeyboardFocus } from '@mikaelcedergren/cx-framework';
import { routes } from './app.routes';
import { SeoTitleStrategy } from './shared/seo';
registerLocaleData(sv);
registerLocaleData(da);

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useFactory: activeLanguage },
    { provide: APP_BASE_HREF, useFactory: () => languageBase(activeLanguage()) },
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideCxKeyboardFocus(),
    provideClientHydration(withEventReplay()),
    provideAppInitializer(() => {
      const document = inject(DOCUMENT);
      inject(ViewportScroller).setOffset(() => {
        // Router scrolling uses coordinates, so honor the target's existing CSS
        // landing room just as native fragment navigation does.
        const target = document.querySelector(':target');
        const margin =
          target && document.defaultView
            ? Number.parseFloat(
                document.defaultView.getComputedStyle(target).scrollMarginBlockStart,
              )
            : 0;
        return [0, Number.isFinite(margin) ? margin : 0];
      });
    }),
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
