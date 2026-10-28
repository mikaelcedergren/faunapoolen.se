import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  CxButtonComponent,
  CxHeroComponent,
  CxStackComponent,
} from '@mikaelcedergren/cx-framework';
import { SiteMeasurement } from '../site-measurement';
import { SiteMarketing } from '../site-marketing';
import { SitePage } from '../site-page';
import { SiteShellComponent } from '../site-shell.component';

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
        layout="stacked"
      />
      <section class="cx-container cx-py-2xl">
        <cx-stack gap="lg" align="start">
          @if (measurement.available() || marketing.available()) {
            <p class="cx-editorial">{{ choice }}</p>
            <cx-button [text]="settings" (click)="shell.openCookieSettings($event)" />
          }
          <div class="cx-editorial">
            <p>{{ introduction }}</p>
            @if (measurement.available()) {
              <h2 class="fp-heading">{{ statisticsTitle }}</h2>
              <p>{{ statistics }}</p>
              <p>{{ google }}</p>
            }
            <h2 class="fp-heading">{{ marketingTitle }}</h2>
            <p>{{ marketingDetails }}</p>
            <p>{{ marketingData }}</p>
            <h2 class="fp-heading">{{ storageTitle }}</h2>
            <ul>
              @if (measurement.available()) {
                <li>{{ analyticsCookies }}</li>
                <li>{{ visitStorage }}</li>
              }
              <li>{{ consentStorage }}</li>
              <li>{{ marketingCookies }}</li>
              <li>{{ marketingStorage }}</li>
            </ul>
            <h2 class="fp-heading">{{ withdrawalTitle }}</h2>
            @if (measurement.available()) {
              <p>{{ withdrawal }}</p>
            }
            <p>{{ marketingWithdrawal }}</p>
            <p>{{ contact }} <a href="mailto:info@faunapoolen.se">info&#64;faunapoolen.se</a></p>
          </div>
        </cx-stack>
      </section>
    </fp-site-shell>
  `,
})
export class CookiesPage extends SitePage {
  protected readonly measurement = inject(SiteMeasurement);
  protected readonly marketing = inject(SiteMarketing);
  protected readonly title = $localize`:@@cookies.title:Cookies`;
  protected readonly settings = $localize`:@@site.measurement.settings:Cookie settings`;
  protected readonly choice = $localize`:@@cookies.choice:Your cookie choice does not affect access to the website or your ability to send an enquiry.`;
  protected readonly introduction = $localize`:@@cookies.introduction:Faunapoolen uses browser storage to remember your choice. Optional tracking requires your permission.`;
  protected readonly statisticsTitle = $localize`:@@cookies.statisticsTitle:What the statistics measure`;
  protected readonly statistics = $localize`:@@cookies.statistics:With your permission, we measure page visits, interest in pool packages and progress through the enquiry form, including successful enquiries. Events include the page address without query parameters, page title, language, landing page and a broad source category such as search or referral. They do not include your name, email, phone number, address or message.`;
  protected readonly google = $localize`:@@cookies.google:Google provides the analytics service and receives cookie identifiers and technical information such as your IP address and browser information when analytics is active. Statistics consent does not enable advertising.`;
  protected readonly marketingTitle = $localize`:@@cookies.marketingTitle:Marketing with Meta`;
  protected readonly marketingDetails = $localize`:@@cookies.marketingDetails:If you allow marketing, the Meta Pixel records public page views and confirmed enquiries to measure and improve our advertising on Facebook and Instagram. Meta may also use this activity to personalise advertising.`;
  protected readonly marketingData = $localize`:@@cookies.marketingData:Meta receives browser and cookie identifiers, page and referring addresses, ad click information and technical data such as your IP address. We do not send enquiry field contents or enable advanced matching in our code. Tracking does not run in the private admin area.`;
  protected readonly marketingCookies = $localize`:@@cookies.marketingCookies:_fbp and _fbc: optional Meta cookies that identify your browser and ad clicks, normally lasting 90 days and renewed during use. Meta may also use its own cookies when your browser contacts its services.`;
  protected readonly marketingStorage = $localize`:@@cookies.marketingStorage:fp-marketing-consent-v1: local storage that remembers your separate marketing choice until you change it or clear browser data. The saved choice is not sent to Meta.`;
  protected readonly marketingWithdrawal = $localize`:@@cookies.marketingWithdrawal:To stop Meta tracking, open cookie settings in the footer of any public page and choose Reject. This stops future events and removes this website's _fbp and _fbc cookies. It cannot remove information already sent or cookies on Meta's own domains.`;
  protected readonly storageTitle = $localize`:@@cookies.storageTitle:What is stored and for how long`;
  protected readonly analyticsCookies = $localize`:@@cookies.analyticsCookies:_ga and _ga_E1BFSP43WZ: optional first-party cookies used by Google Analytics to distinguish browsers and sessions. They are configured to expire after 180 days, renewed during use. Statistics are shared with Google.`;
  protected readonly consentStorage = $localize`:@@cookies.consentStorage:fp-analytics-consent-v1: local storage containing only your allow or reject choice. It remains until you change it or clear this website's browser data. It is not sent to Google.`;
  protected readonly visitStorage = $localize`:@@cookies.visitStorage:fp-analytics-visit: optional session storage for your landing page and broad source category. Used only after acceptance, removed when you reject statistics or end the browser session.`;
  protected readonly withdrawalTitle = $localize`:@@cookies.withdrawalTitle:Changing your choice`;
  protected readonly withdrawal = $localize`:@@cookies.withdrawal:Open cookie settings in the footer of any public page. Deselect statistics and save your choices to stop future analytics events and remove this website's Google Analytics cookies and visit context. This does not undo statistics already sent. You can also clear saved choices through your browser.`;
  protected readonly contact = $localize`:@@cookies.contact:For questions about our use of cookies, contact`;
}
