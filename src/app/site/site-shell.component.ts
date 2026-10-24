import { FAUNAPOOLEN_SERVICES } from './content/faunapoolen-editorial';
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  Input,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import {
  CX_THEMES,
  CxButtonComponent,
  CxLanguageSelectorComponent,
  CxMastheadComponent,
  CxMastheadItem,
  CxStackComponent,
} from '@mikaelcedergren/cx-framework';
import { FAUNAPOOLEN_CONTACT } from './content/faunapoolen-contact';
import { FAUNAPOOLEN_COPY, FaunapoolenPage } from './content/faunapoolen-content';
import { SITE_UI } from './content/site-ui';
import { CookieNoticeComponent } from './cookie-notice.component';
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES } from './language';
import { ContactInvitationComponent } from './sections/contact-invitation.component';
import { SiteMeasurement } from './site-measurement';
import { SitePage } from './site-page';

@Component({
  selector: 'fp-site-shell',
  imports: [
    CxMastheadComponent,
    CxButtonComponent,
    CxLanguageSelectorComponent,
    CxStackComponent,
    CookieNoticeComponent,
    ContactInvitationComponent,
  ],
  templateUrl: './site-shell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteShellComponent extends SitePage implements OnInit {
  protected readonly contactDetails = FAUNAPOOLEN_CONTACT;
  protected readonly ui = SITE_UI;
  protected readonly copy = FAUNAPOOLEN_COPY;
  protected readonly languages = SUPPORTED_LANGUAGES.map((locale) => ({
    locale,
    label: LANGUAGE_NAMES[locale],
    href: this.routeFor(this.page, locale, this.guideId),
  }));

  protected readonly navItems: CxMastheadItem[] = [
    this.navItem('home', this.copy.nav.home),
    this.navItem('nature-pools', this.copy.nav.naturePools),
    this.navItem('pricing', this.copy.nav.pricing),
    this.navItem('waterscapes', this.copy.nav.waterscapes),
    this.navItem('guides', this.copy.nav.guides),
    this.navItem('about', this.copy.nav.about),
  ];

  private navItem(
    page: Exclude<FaunapoolenPage, 'guide' | 'gotland'>,
    label: string,
  ): CxMastheadItem {
    if (page === 'guides' && this.page === 'guide') {
      return { id: page, label, href: this.routeFor(page), active: true };
    }
    if (
      page === 'nature-pools' &&
      ['skane', 'halland', 'blekinge', 'smaland'].includes(this.page)
    ) {
      return { id: page, label, href: this.routeFor(page), active: true };
    }
    return { id: page, label, href: this.routeFor(page), active: page === this.page };
  }

  @Input({ transform: booleanAttribute }) leadFocused = false;
  @Input() enquiryTarget?: string;
  @Input({ transform: booleanAttribute }) showInvitation = true;
  protected get enquiryHref(): string {
    if (this.enquiryTarget) return this.enquiryTarget;
    return this.configureHref + (this.leadFocused ? '?service=pool' : '');
  }
  @HostListener('click', ['$event'])
  protected openInlineEnquiry(event: MouseEvent): void {
    if (
      !this.enquiryTarget ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const anchor = (event.target as Element | null)?.closest('a');
    if (!anchor || anchor.getAttribute('href') !== this.enquiryTarget) return;
    const fragment = this.enquiryTarget.split('#')[1];
    const target = fragment && this.document.getElementById(fragment);
    if (!target) return;
    event.preventDefault();
    void this.router.navigate([], { fragment, queryParamsHandling: 'preserve' }).then(() => {
      target.scrollIntoView({ block: 'start' });
      target.querySelector<HTMLElement>('input')?.focus({ preventScroll: true });
    });
  }
  protected readonly contactUs = $localize`:@@site.masthead.contactUs:Contact us`;
  protected readonly footerContact = $localize`:@@site.footer.contact:Contact`;
  protected readonly footerCertification = $localize`:@@site.footer.certification:Certified Aquascape Contractor`;
  protected readonly footerGroups = [
    {
      label: $localize`:@@site.footer.explore:Explore`,
      items: ['nature-pools', 'waterscapes', 'pricing'].map((id) =>
        this.navItems.find((item) => item.id === id)!,
      ),
    },
    {
      label: 'Faunapoolen',
      items: ['home', 'guides', 'about'].map((id) => this.navItems.find((item) => item.id === id)!),
    },
  ];
  private readonly router = inject(Router);
  protected readonly measurement = inject(SiteMeasurement);
  private readonly cookieNotice = viewChild(CookieNoticeComponent);

  openCookieSettings(event: Event): void {
    this.cookieNotice()?.openSettings(event);
  }
  private readonly navigationContext = signal('');

  protected languageHref(href: string): string {
    return href + this.navigationContext();
  }

  private refreshNavigationContext(): void {
    const browser = this.document.defaultView;
    if (!browser) return;
    const query = new URLSearchParams(browser.location.search);
    const kept = new URLSearchParams();
    if (this.page === 'configure' || this.page === 'nature-pools') {
      const service = query.get('service');
      const selected = query.get('package');
      if (service && FAUNAPOOLEN_SERVICES.some((item) => item.id === service))
        kept.set('service', service);
      if (selected && ['glade', 'summer', 'horizon'].includes(selected))
        kept.set('package', selected);
    }
    this.navigationContext.set((kept.size ? '?' + kept.toString() : '') + browser.location.hash);
  }
  protected readonly languageOptions = this.languages.map((language) => ({
    id: language.locale,
    label: language.label,
    flag: { en: '🇬🇧', sv: '🇸🇪', da: '🇩🇰', it: '🇮🇹', es: '🇪🇸', pt: '🇵🇹', de: '🇩🇪', pl: '🇵🇱' }[
      language.locale
    ],
  }));

  protected changeLanguage(id: string): void {
    const language = this.languages.find((item) => item.locale === id);
    const browser = this.document.defaultView;
    if (language && browser && id !== this.locale) {
      this.refreshNavigationContext();
      browser.location.assign(this.languageHref(language.href));
    }
  }

  protected readonly languageLabel = $localize`:@@site.language.label:Language`;

  constructor() {
    super();
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationEnd) this.refreshNavigationContext();
    });
    afterNextRender(() => {
      this.refreshNavigationContext();
      this.measurement.initialize();
      this.measurement.track('page_view');
    });
  }

  ngOnInit(): void {
    for (const theme of CX_THEMES)
      this.document.documentElement.classList.remove(`theme-${theme.id}`);
    this.document.documentElement.classList.add('theme-aqua');
  }
}
