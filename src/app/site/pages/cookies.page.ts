import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  CxButtonComponent,
  CxHeroComponent,
  CxStackComponent,
} from '@mikaelcedergren/cx-framework';
import { SitePage } from '../site-page';
import { SiteShellComponent } from '../site-shell.component';
import { SiteMeasurement } from '../site-measurement';

@Component({
  selector: 'fp-cookies-page',
  imports: [SiteShellComponent, CxHeroComponent, CxButtonComponent, CxStackComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fp-site-shell #shell>
      <cx-hero
        [underMasthead]="true"
        headingClass="cx-font-regular"
        [heading]="title"
        variant="stacked"
      />
      <section class="cx-container cx-py-2xl">
        <cx-stack gap="lg" align="start">
          @if (measurement.available()) {
            <p>{{ choice }}</p>
            <cx-button [text]="settings" (click)="shell.openCookieSettings($event)" />
          }
          <div class="cx-editorial">
            <p>{{ introduction }}</p>
            <h2>{{ statisticsTitle }}</h2>
            <p>{{ statistics }}</p>
            <p>{{ google }}</p>
            <p>
              <a
                href="https://policies.google.com/technologies/partner-sites"
                rel="noopener noreferrer"
                >{{ googleLink }}</a
              >
            </p>
            <h2>{{ storageTitle }}</h2>
            <ul>
              <li>{{ analyticsCookies }}</li>
              <li>{{ consentStorage }}</li>
              <li>{{ visitStorage }}</li>
              <li>{{ languageStorage }}</li>
            </ul>
            <h2>{{ withdrawalTitle }}</h2>
            <p>{{ withdrawal }}</p>
            <p>{{ contact }} <a href="mailto:info@faunapoolen.se">info&#64;faunapoolen.se</a></p>
          </div>
        </cx-stack>
      </section>
    </fp-site-shell>
  `,
})
export class CookiesPage extends SitePage {
  protected readonly measurement = inject(SiteMeasurement);
  protected readonly title = $localize`:@@cookies.title:Cookies and website statistics`;
  protected readonly settings = $localize`:@@site.measurement.settings:Cookie settings`;
  protected readonly choice = $localize`:@@cookies.choice:Allow or reject statistics. Your choice does not affect your access to the website or your ability to send an enquiry.`;
  protected readonly introduction = $localize`:@@cookies.introduction:Faunapoolen uses browser storage to remember your choices. Optional Google Analytics statistics require your permission.`;
  protected readonly statisticsTitle = $localize`:@@cookies.statisticsTitle:What the statistics measure`;
  protected readonly statistics = $localize`:@@cookies.statistics:With your permission, we measure page visits, interest in pool packages and progress through the enquiry form, including successful enquiries. Events include the page address without query parameters, page title, language, landing page and a broad source category such as search or referral. They do not include your name, email, phone number, address or message.`;
  protected readonly google = $localize`:@@cookies.google:Google provides the analytics service and receives cookie identifiers and technical information such as your IP address and browser information when analytics is active. We do not enable advertising cookies or personalised advertising. Google's information explains how it processes data and where it may be processed.`;
  protected readonly googleLink = $localize`:@@site.measurement.privacy:How Google uses this data`;
  protected readonly storageTitle = $localize`:@@cookies.storageTitle:What is stored and for how long`;
  protected readonly analyticsCookies = $localize`:@@cookies.analyticsCookies:_ga and _ga_E1BFSP43WZ: optional first-party cookies used by Google Analytics to distinguish browsers and sessions. They are configured to expire after 180 days, renewed during use. Statistics are shared with Google.`;
  protected readonly consentStorage = $localize`:@@cookies.consentStorage:fp-analytics-consent-v1: local storage containing only your allow or reject choice. It remains until you change it or clear this website's browser data. It is not sent to Google.`;
  protected readonly visitStorage = $localize`:@@cookies.visitStorage:fp-analytics-visit: optional session storage for your landing page and broad source category. Used only after acceptance, removed when you reject statistics or end the browser session.`;
  protected readonly languageStorage = $localize`:@@cookies.languageStorage:fp-language-choice and fp-language-dismissed entries: session storage remembering your language selection or dismissal of a language suggestion. Removed when the browser session ends and not shared with Google.`;
  protected readonly withdrawalTitle = $localize`:@@cookies.withdrawalTitle:Changing your choice`;
  protected readonly withdrawal = $localize`:@@cookies.withdrawal:Open cookie settings in the footer of any public page and select reject to withdraw consent. This stops future analytics events and removes this website's Google Analytics cookies and visit context. It does not undo statistics already sent. You can also clear saved choices through your browser.`;
  protected readonly contact = $localize`:@@cookies.contact:For questions about our use of cookies, contact`;
}
