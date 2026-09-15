export type FaunapoolenLocale = 'en' | 'sv' | 'da';
export type FaunapoolenPage =
  | 'home'
  | 'nature-pools'
  | 'projects'
  | 'gotland'
  | 'waterscapes'
  | 'guides'
  | 'about'
  | 'configure'
  | 'guide';

export type FaunapoolenGuideId =
  | 'build'
  | 'difference'
  | '5-common-problems-installing-a-nature-pool'
  | 'how-faunapoolen-helps-golf-clubs-manage-ponds-lakes-and-streams'
  | 'pool-conversions'
  | 'sports-stars-natural-ponds'
  | 'can-i-use-water-storage-solutions-when-traditional-wells-arent-an-option'
  | 'creating-harmony-intergrating-water-features-with-your-landscape'
  | 'small-features-for-small-spaces'
  | 'algae-control-and-maintenance-tips'
  | 'how-filtering-works-with-nature-pools'
  | 'why-you-should-get-a-natural-pool';

export interface FaunapoolenPackage {
  readonly id: 'glade' | 'summer' | 'horizon';
  readonly name: string;
  readonly area: string;
  readonly tagline: string;
  readonly description: string;
  readonly includes: readonly string[];
  readonly price: number;
  readonly featured?: boolean;
}

export interface FaunapoolenFeature {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly price: number;
}

export const FAUNAPOOLEN_PACKAGES: readonly FaunapoolenPackage[] = [
  {
    id: 'glade',
    name: $localize`:@@site.packages.glade.name:The glade`,
    area: $localize`:@@site.packages.glade.area:12–18 m² swim area`,
    tagline: $localize`:@@site.packages.glade.tagline:A nature pool for a smaller garden.`,
    description: $localize`:@@site.packages.glade.description:A smaller pool with room for a dip, plants and relaxation.`,
    includes: [
      $localize`:@@site.packages.glade.includes.0:Site assessment and design proposal`,
      $localize`:@@site.packages.glade.includes.1:Biological filtration and circulation`,
      $localize`:@@site.packages.glade.includes.2:Planting and edging around the pool`,
    ],
    price: 495_000,
  },
  {
    id: 'summer',
    name: $localize`:@@site.packages.summer.name:Summer days`,
    area: $localize`:@@site.packages.summer.area:24–36 m² swim area`,
    tagline: $localize`:@@site.packages.summer.tagline:Room for every kind of swim the day brings.`,
    description: $localize`:@@site.packages.summer.description:A pool where the family can swim, play and relax together.`,
    includes: [
      $localize`:@@site.packages.summer.includes.0:Detailed site and water circulation assessment`,
      $localize`:@@site.packages.summer.includes.1:Large biological filtration zone`,
      $localize`:@@site.packages.summer.includes.2:Seating edge or steps into the pool`,
    ],
    price: 695_000,
    featured: true,
  },
  {
    id: 'horizon',
    name: $localize`:@@site.packages.horizon.name:The horizon`,
    area: $localize`:@@site.packages.horizon.area:40–60 m² swim area`,
    tagline: $localize`:@@site.packages.horizon.tagline:More room to swim and spend time together.`,
    description: $localize`:@@site.packages.horizon.description:A larger nature pool with a coordinated design for the pool and surrounding garden.`,
    includes: [
      $localize`:@@site.packages.horizon.includes.0:Design for the pool and garden`,
      $localize`:@@site.packages.horizon.includes.1:Pool and biological filtration designed for the site`,
      $localize`:@@site.packages.horizon.includes.2:Planning of materials, lighting and level changes`,
    ],
    price: 995_000,
  },
] as const;

export const FAUNAPOOLEN_FEATURES: readonly FaunapoolenFeature[] = [
  {
    id: 'stream',
    name: $localize`:@@site.features.stream.name:Stream or waterfall`,
    description: $localize`:@@site.features.stream.description:Flowing water that brings sound and movement to the garden.`,
    price: 85_000,
  },
  {
    id: 'deck',
    name: $localize`:@@site.features.deck.name:Timber deck`,
    description: $localize`:@@site.features.deck.description:Space beside the pool for sun loungers, relaxation and company.`,
    price: 95_000,
  },
  {
    id: 'stone',
    name: $localize`:@@site.features.stone.name:Natural stone terrace`,
    description: $localize`:@@site.features.stone.description:Durable granite or slate selected for the site’s colour and character.`,
    price: 125_000,
  },
  {
    id: 'lighting',
    name: $localize`:@@site.features.lighting.name:Lighting`,
    description: $localize`:@@site.features.lighting.description:Poolside lighting for late swims and evenings in the garden.`,
    price: 35_000,
  },
  {
    id: 'heating',
    name: $localize`:@@site.features.heating.name:Extended swimming season`,
    description: $localize`:@@site.features.heating.description:Heating for more swims in spring and autumn.`,
    price: 65_000,
  },
] as const;

export const FAUNAPOOLEN_SITE_OPTIONS = [
  {
    id: 'open',
    name: $localize`:@@site.site_options.open.name:Open access`,
    description: $localize`:@@site.site_options.open.description:Machinery can reach the work area without special lifting or protection.`,
    price: 0,
  },
  {
    id: 'limited',
    name: $localize`:@@site.site_options.limited.name:Constrained access`,
    description: $localize`:@@site.site_options.limited.description:Narrow passage, sensitive garden or additional material handling.`,
    price: 75_000,
  },
  {
    id: 'complex',
    name: $localize`:@@site.site_options.complex.name:Rock or major level changes`,
    description: $localize`:@@site.site_options.complex.description:Rock, level changes or difficult deliveries to the site.`,
    price: 150_000,
  },
] as const;

export const FAUNAPOOLEN_SIZE_OPTIONS = [
  {
    id: 'included',
    name: $localize`:@@site.size_options.included.name:Within the package range`,
    description: $localize`:@@site.size_options.included.description:The swim area included in the selected package.`,
    price: 0,
  },
  {
    id: 'larger',
    name: $localize`:@@site.size_options.larger.name:Larger`,
    description: $localize`:@@site.size_options.larger.description:More swimming space and a larger biological filtration zone.`,
    price: 120_000,
  },
  {
    id: 'expansive',
    name: $localize`:@@site.size_options.expansive.name:Extra large`,
    description: $localize`:@@site.size_options.expansive.description:A large swimming area for a larger garden.`,
    price: 260_000,
  },
] as const;

export const FAUNAPOOLEN_CARE_PRICE = 19_500;

interface FaunapoolenSiteCopy {
  readonly menuLabel: string;
  readonly start: string;
  readonly nav: {
    readonly naturePools: string;
    readonly projects: string;
    readonly waterscapes: string;
    readonly guides: string;
    readonly about: string;
  };
  readonly home: {
    readonly eyebrow: string;
    readonly title: string;
    readonly ingress: string;
    readonly primary: string;
    readonly secondary: string;
    readonly packagesTitle: string;
    readonly packagesBody: string;
    readonly processTitle: string;
    readonly waterscapeTitle: string;
    readonly waterscapeBody: string;
  };
  readonly naturePools: {
    readonly eyebrow: string;
    readonly title: string;
    readonly ingress: string;
    readonly careTitle: string;
    readonly careBody: string;
    readonly carePoints: readonly string[];
  };
  readonly projects: {
    readonly eyebrow: string;
    readonly title: string;
    readonly ingress: string;
  };
  readonly waterscapes: {
    readonly eyebrow: string;
    readonly title: string;
    readonly ingress: string;
    readonly typesTitle: string;
    readonly types: readonly {
      readonly title: string;
      readonly body: string;
    }[];
    readonly methodTitle: string;
    readonly methodBody: string;
  };
  readonly guides: {
    readonly title: string;
    readonly ingress: string;
    readonly read: string;
  };
  readonly about: {
    readonly eyebrow: string;
    readonly title: string;
    readonly ingress: string;
    readonly methodTitle: string;
    readonly methodBody: string;
    readonly teamTitle: string;
  };
  readonly configure: {
    readonly title: string;
    readonly ingress: string;
    readonly estimate: string;
    readonly vat: string;
    readonly nonBinding: string;
    readonly yearly: string;
    readonly packageTitle: string;
    readonly siteTitle: string;
    readonly sizeTitle: string;
    readonly sizeBody: string;
    readonly featuresTitle: string;
    readonly careTitle: string;
    readonly careYes: string;
    readonly contactTitle: string;
    readonly name: string;
    readonly email: string;
    readonly phone: string;
    readonly location: string;
    readonly contactPeriod: string;
    readonly requiredError: string;
    readonly emailError: string;
    readonly summaryTitle: string;
    readonly selectedPackage: string;
    readonly care: string;
    readonly none: string;
  };
  readonly common: {
    readonly from: string;
    readonly inclVat: string;
    readonly familyPackage: string;
    readonly viewPackage: string;
    readonly talkTitle: string;
    readonly talkBody: string;
    readonly talkButton: string;
    readonly guideLabel: string;
  };
}

export const FAUNAPOOLEN_COPY = {
  menuLabel: $localize`:@@site.copy.menuLabel:Faunapoolen menu`,
  start: $localize`:@@site.copy.start:Tell us about your project`,
  nav: {
    naturePools: $localize`:@@site.copy.nav.naturePools:Nature pools`,
    projects: $localize`:@@site.copy.nav.projects:Projects`,
    waterscapes: $localize`:@@site.copy.nav.waterscapes:Waterscapes`,
    guides: $localize`:@@site.copy.nav.guides:Guides`,
    about: $localize`:@@site.copy.nav.about:About`,
  },
  home: {
    eyebrow: $localize`:@@site.copy.home.eyebrow:Nature pools for your garden`,
    title: $localize`:@@site.copy.home.title:A pool that belongs here.`,
    ingress: $localize`:@@site.copy.home.ingress:We build nature pools to suit your garden. The water is filtered biologically, without chlorine. We help with planning, construction and maintenance.`,
    primary: $localize`:@@site.copy.home.primary:Tell us about your project`,
    secondary: $localize`:@@site.copy.home.secondary:See packages and prices`,
    packagesTitle: $localize`:@@site.copy.home.packagesTitle:Three packages. Designed around your garden.`,
    packagesBody: $localize`:@@site.copy.home.packagesBody:Compare sizes, what is included and approximate prices. We then adapt the pool’s shape, materials and planting to your site.`,
    processTitle: $localize`:@@site.copy.home.processTitle:You always know what comes next.`,
    waterscapeTitle: $localize`:@@site.copy.home.waterscapeTitle:Waterscapes that make a place feel alive.`,
    waterscapeBody: $localize`:@@site.copy.home.waterscapeBody:We also build koi ponds, streams and waterfalls, with planting, stone and filtration suited to your garden.`,
  },
  naturePools: {
    eyebrow: $localize`:@@site.copy.naturePools.eyebrow:Nature pools`,
    title: $localize`:@@site.copy.naturePools.title:Like a dip in a lake. In your own garden.`,
    ingress: $localize`:@@site.copy.naturePools.ingress:A nature pool filters water biologically, without chlorine. We design the pool and filtration around your garden and how you want to swim.`,
    careTitle: $localize`:@@site.copy.naturePools.careTitle:How to care for your nature pool.`,
    careBody: $localize`:@@site.copy.naturePools.careBody:You receive a maintenance plan for the year. We can also help with spring start-up, checks and winter preparation.`,
    carePoints: [
      $localize`:@@site.copy.naturePools.carePoints.0:Routine checks of circulation and water level`,
      $localize`:@@site.copy.naturePools.carePoints.1:Pruning and care of the planted zone`,
      $localize`:@@site.copy.naturePools.carePoints.2:Spring start-up and winter closing for the site’s system`,
    ],
  },
  projects: {
    eyebrow: $localize`:@@site.copy.projects.eyebrow:Projects`,
    title: $localize`:@@site.copy.projects.title:Our completed water features.`,
    ingress: $localize`:@@site.copy.projects.ingress:Here we share our completed projects, starting with the nature pool on Gotland.`,
  },
  waterscapes: {
    eyebrow: $localize`:@@site.copy.waterscapes.eyebrow:Waterscapes`,
    title: $localize`:@@site.copy.waterscapes.title:Ponds, streams and waterfalls for your garden.`,
    ingress: $localize`:@@site.copy.waterscapes.ingress:Would you like a fish pond, the sound of a stream or a quiet pool of water? We help you plan, build and maintain it.`,
    typesTitle: $localize`:@@site.copy.waterscapes.typesTitle:What kind of water feature would you like?`,
    types: [
      {
        title: $localize`:@@site.copy.waterscapes.types.0.title:Koi ponds`,
        body: $localize`:@@site.copy.waterscapes.types.0.body:Clear, stable water with depth, shelter and circulation designed around the wellbeing of the fish.`,
      },
      {
        title: $localize`:@@site.copy.waterscapes.types.1.title:Streams and waterfalls`,
        body: $localize`:@@site.copy.waterscapes.types.1.body:Water flowing over stone, bringing sound and movement into the garden.`,
      },
      {
        title: $localize`:@@site.copy.waterscapes.types.2.title:Reflecting ponds`,
        body: $localize`:@@site.copy.waterscapes.types.2.body:A still pond reflecting the house, trees and sky.`,
      },
    ],
    methodTitle: $localize`:@@site.copy.waterscapes.methodTitle:Built to work well and be maintained.`,
    methodBody: $localize`:@@site.copy.waterscapes.methodBody:We plan the water flow and filtration, and make sure equipment can be reached for servicing. Stone, timber and plants are chosen to suit your garden.`,
  },
  guides: {
    title: $localize`:@@site.copy.guides.title:Get to know nature pools.`,
    ingress: $localize`:@@site.copy.guides.ingress:Clear explanations of cost, purification, building and the difference between a nature pool and a conventional pool.`,
    read: $localize`:@@site.copy.guides.read:Read the guide`,
  },
  about: {
    eyebrow: $localize`:@@site.copy.about.eyebrow:About Faunapoolen`,
    title: $localize`:@@site.copy.about.title:The people behind your waterscape.`,
    ingress: $localize`:@@site.copy.about.ingress:We plan and build nature pools, ponds and streams. Benjamin is your first contact and helps you get the project started.`,
    methodTitle: $localize`:@@site.copy.about.methodTitle:A clear plan. A personal contact.`,
    methodBody: $localize`:@@site.copy.about.methodBody:We make early decisions together, show what drives cost and make the technology understandable. You know what will be built and how it will be maintained.`,
    teamTitle: $localize`:@@site.copy.about.teamTitle:The team behind the water`,
  },
  configure: {
    title: $localize`:@@site.copy.configure.title:Your project starts here.`,
    ingress: $localize`:@@site.copy.configure.ingress:Tell us about your garden and what you would like to create. You can also choose a pool package to explore an estimated price.`,
    estimate: $localize`:@@site.copy.configure.estimate:Estimated price`,
    vat: $localize`:@@site.copy.configure.vat:incl. VAT`,
    nonBinding: $localize`:@@site.copy.configure.nonBinding:The price is an estimate. You receive a quotation after we have assessed the site.`,
    yearly: $localize`:@@site.copy.configure.yearly:per year`,
    packageTitle: $localize`:@@site.copy.configure.packageTitle:Which package suits you?`,
    siteTitle: $localize`:@@site.copy.configure.siteTitle:What are the site conditions?`,
    sizeTitle: $localize`:@@site.copy.configure.sizeTitle:How much swim area do you want?`,
    sizeBody: $localize`:@@site.copy.configure.sizeBody:Choose the size included in the package or a larger swimming area.`,
    featuresTitle: $localize`:@@site.copy.configure.featuresTitle:Which additions would you like?`,
    careTitle: $localize`:@@site.copy.configure.careTitle:Would you like help with maintenance?`,
    careYes: $localize`:@@site.copy.configure.careYes:Yes, add annual maintenance`,
    contactTitle: $localize`:@@site.copy.configure.contactTitle:Your contact details`,
    name: $localize`:@@site.copy.configure.name:Name`,
    email: $localize`:@@site.copy.configure.email:Email`,
    phone: $localize`:@@site.copy.configure.phone:Phone`,
    location: $localize`:@@site.copy.configure.location:Town or postcode`,
    contactPeriod: $localize`:@@site.copy.configure.contactPeriod:When is the best time to contact you?`,
    requiredError: $localize`:@@site.copy.configure.requiredError:Please complete this field.`,
    emailError: $localize`:@@site.copy.configure.emailError:Enter a valid email address.`,
    summaryTitle: $localize`:@@site.copy.configure.summaryTitle:Your project at a glance`,
    selectedPackage: $localize`:@@site.copy.configure.selectedPackage:Package`,
    care: $localize`:@@site.copy.configure.care:Annual maintenance`,
    none: $localize`:@@site.copy.configure.none:None selected`,
  },
  common: {
    from: $localize`:@@site.copy.common.from:From`,
    inclVat: $localize`:@@site.copy.common.inclVat:incl. VAT`,
    familyPackage: $localize`:@@site.copy.common.familyPackage:For family swimming`,
    viewPackage: $localize`:@@site.copy.common.viewPackage:Choose package`,
    talkTitle: $localize`:@@site.copy.common.talkTitle:What do you have in mind for your garden?`,
    talkBody: $localize`:@@site.copy.common.talkBody:A nature pool, a pond or the beginning of an idea. Tell us about the site and what you have in mind.`,
    talkButton: $localize`:@@site.copy.common.talkButton:Tell us about your project`,
    guideLabel: $localize`:@@site.copy.common.guideLabel:Guide`,
  },
} as const satisfies FaunapoolenSiteCopy;

export const FAUNAPOOLEN_PROCESS = [
  {
    number: '01',
    title: $localize`:@@site.process.0.title:Describe the place`,
    body: $localize`:@@site.process.0.body:Tell us about your garden, what you have in mind and when you would like to begin.`,
  },
  {
    number: '02',
    title: $localize`:@@site.process.1.title:Discuss your site`,
    body: $localize`:@@site.process.1.body:Benjamin discusses the site and your wishes with you. You explore the possibilities, budget and next steps.`,
  },
  {
    number: '03',
    title: $localize`:@@site.process.2.title:Design and quotation`,
    body: $localize`:@@site.process.2.body:You receive a proposal for the pool’s design, filtration and materials, together with a quotation.`,
  },
  {
    number: '04',
    title: $localize`:@@site.process.3.title:Build and maintenance`,
    body: $localize`:@@site.process.3.body:We build the pool, start the filtration and show you how to maintain it.`,
  },
] as const;

export const FAUNAPOOLEN_TEAM = [
  {
    name: 'Benjamin',
    role: $localize`:@@site.team.0.role:Your first contact`,
    body: $localize`:@@site.team.0.body:Helps you plan the project and understand your choices, from the first idea to the finished pool.`,
  },
  {
    name: 'Scott',
    role: $localize`:@@site.team.1.role:CEO`,
    body: $localize`:@@site.team.1.body:Responsible for the business, partnerships and projects.`,
  },
  {
    name: 'Mikael',
    role: $localize`:@@site.team.2.role:Marketing`,
    body: $localize`:@@site.team.2.body:Responsible for marketing and information about our nature pools.`,
  },
] as const;
