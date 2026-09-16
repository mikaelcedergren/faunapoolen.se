export type FaunapoolenLocale = 'en' | 'sv' | 'da';
export type FaunapoolenPage =
  | 'home'
  | 'nature-pools'
  | 'projects'
  | 'gotland'
  | 'waterscapes'
  | 'guides'
  | 'about'
  | 'faq'
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
  readonly description: string;
  readonly includes: readonly string[];
  readonly price: number;
}

export const FAUNAPOOLEN_PACKAGES: readonly FaunapoolenPackage[] = [
  {
    id: 'glade',
    name: $localize`:@@site.packages.glade.name:Daily dips`,
    area: $localize`:@@site.packages.glade.area:12–18 m² swim area`,
    description: $localize`:@@site.packages.glade.description:A compact swimming area with planting and edging around the pool.`,
    includes: [
      $localize`:@@site.packages.glade.includes.0:Site assessment and design proposal`,
      $localize`:@@site.packages.glade.includes.1:Biological filtration and circulation`,
      $localize`:@@site.packages.glade.includes.2:Planting and edging around the pool`,
    ],
    price: 495_000,
  },
  {
    id: 'summer',
    name: $localize`:@@site.packages.summer.name:Swim together`,
    area: $localize`:@@site.packages.summer.area:24–36 m² swim area`,
    description: $localize`:@@site.packages.summer.description:More swimming space, with a seating edge or steps into the water.`,
    includes: [
      $localize`:@@site.packages.summer.includes.0:Detailed site and water circulation assessment`,
      $localize`:@@site.packages.summer.includes.1:Large biological filtration zone`,
      $localize`:@@site.packages.summer.includes.2:Seating edge or steps into the pool`,
    ],
    price: 695_000,
  },
  {
    id: 'horizon',
    name: $localize`:@@site.packages.horizon.name:More room`,
    area: $localize`:@@site.packages.horizon.area:40–60 m² swim area`,
    description: $localize`:@@site.packages.horizon.description:A larger swimming area, with the design extending into the surrounding garden.`,
    includes: [
      $localize`:@@site.packages.horizon.includes.0:Design for the pool and garden`,
      $localize`:@@site.packages.horizon.includes.1:Pool and biological filtration designed for the site`,
      $localize`:@@site.packages.horizon.includes.2:Planning of materials, lighting and level changes`,
    ],
    price: 995_000,
  },
] as const;

interface FaunapoolenSiteCopy {
  readonly menuLabel: string;
  readonly start: string;
  readonly nav: {
    readonly home: string;
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
    readonly nonBinding: string;
    readonly packageTitle: string;
    readonly name: string;
    readonly email: string;
    readonly phone: string;
    readonly location: string;
    readonly emailError: string;
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
  start: $localize`:@@site.copy.start:Request a consultation`,
  nav: {
    home: $localize`:@@site.copy.nav.home:Start`,
    naturePools: $localize`:@@site.copy.nav.naturePools:Nature pools`,
    projects: $localize`:@@site.copy.nav.projects:Projects`,
    waterscapes: $localize`:@@site.copy.nav.waterscapes:Waterscapes`,
    guides: $localize`:@@site.copy.nav.guides:Blog`,
    about: $localize`:@@site.copy.nav.about:About`,
  },
  home: {
    eyebrow: $localize`:@@site.copy.home.eyebrow:Nature pools for your garden`,
    title: $localize`:@@site.copy.home.title:Make your garden the best part of being home.`,
    ingress: $localize`:@@site.copy.home.ingress:We design and build natural pools, ponds and streams for morning swims, long summer evenings and time together.`,
    primary: $localize`:@@site.copy.home.primary:Request a consultation`,
    secondary: $localize`:@@site.copy.home.secondary:See a completed natural pool`,
    packagesTitle: $localize`:@@site.copy.home.packagesTitle:Find the right scale for your garden.`,
    packagesBody: $localize`:@@site.copy.home.packagesBody:Compare swimming areas and indicative starting prices. We develop the design with you.`,
    processTitle: $localize`:@@site.copy.home.processTitle:From the first idea to your first swim.`,
    waterscapeTitle: $localize`:@@site.copy.home.waterscapeTitle:A place to pause in your own garden.`,
    waterscapeBody: $localize`:@@site.copy.home.waterscapeBody:Watch the fish, listen to a stream or settle beside a quiet pond. We build water features around the way you want to spend time outdoors.`,
  },
  naturePools: {
    eyebrow: $localize`:@@site.copy.naturePools.eyebrow:Nature pools`,
    title: $localize`:@@site.copy.naturePools.title:Your own swimming spot, just outside.`,
    ingress: $localize`:@@site.copy.naturePools.ingress:Start the day with a dip or spend an afternoon by the water. We design and build your pool to suit the way you swim and the garden around it.`,
    careTitle: $localize`:@@site.copy.naturePools.careTitle:Know what caring for your pool involves.`,
    careBody: $localize`:@@site.copy.naturePools.careBody:Biological filtration still needs routine care. At handover, we show you the tasks for your system and provide a maintenance plan.`,
    carePoints: [
      $localize`:@@site.copy.naturePools.carePoints.0:Remove leaves and debris, and check water level and circulation.`,
      $localize`:@@site.copy.naturePools.carePoints.1:Care for the plants and follow the seasonal plan for your system.`,
      $localize`:@@site.copy.naturePools.carePoints.2:We also offer servicing, spring start-up and winter preparation.`,
    ],
  },
  projects: {
    eyebrow: $localize`:@@site.copy.projects.eyebrow:Projects`,
    title: $localize`:@@site.copy.projects.title:A natural pool on Gotland.`,
    ingress: $localize`:@@site.copy.projects.ingress:Built by us on southern Gotland. Hear from Brita about the build and life with the pool.`,
  },
  waterscapes: {
    eyebrow: $localize`:@@site.copy.waterscapes.eyebrow:Waterscapes`,
    title: $localize`:@@site.copy.waterscapes.title:Your own place to slow down.`,
    ingress: $localize`:@@site.copy.waterscapes.ingress:A pond to spend time beside or a stream within earshot of the terrace. We design and build ponds, streams and waterfalls for your garden.`,
    typesTitle: $localize`:@@site.copy.waterscapes.typesTitle:What would you enjoy coming outside for?`,
    types: [
      {
        title: $localize`:@@site.copy.waterscapes.types.0.title:Koi ponds`,
        body: $localize`:@@site.copy.waterscapes.types.0.body:For time spent watching the fish. We plan depth, shelter and filtration for the pond, and explain the care it needs.`,
      },
      {
        title: $localize`:@@site.copy.waterscapes.types.1.title:Streams and waterfalls`,
        body: $localize`:@@site.copy.waterscapes.types.1.body:For the sound of moving water near a favourite seat. We plan the flow, levels and access for maintenance.`,
      },
      {
        title: $localize`:@@site.copy.waterscapes.types.2.title:Reflecting ponds`,
        body: $localize`:@@site.copy.waterscapes.types.2.body:For a quiet place beside the water. We design the pond and its edges around your garden and where you like to sit.`,
      },
    ],
    methodTitle: $localize`:@@site.copy.waterscapes.methodTitle:Designed for your garden. Planned for care.`,
    methodBody: $localize`:@@site.copy.waterscapes.methodBody:The right choice depends on your space, budget and how much care you want to take on. We plan circulation and filtration, with equipment you can reach for servicing.`,
  },
  guides: {
    title: $localize`:@@site.copy.guides.title:Get to know nature pools.`,
    ingress: $localize`:@@site.copy.guides.ingress:Planning, filtration and care. Find answers before you build.`,
    read: $localize`:@@site.copy.guides.read:Read the guide`,
  },
  about: {
    eyebrow: $localize`:@@site.copy.about.eyebrow:About Faunapoolen`,
    title: $localize`:@@site.copy.about.title:About Faunapoolen`,
    ingress: $localize`:@@site.copy.about.ingress:We design and build nature pools and water features throughout Sweden, with selected projects elsewhere in the EU.`,
    methodTitle: $localize`:@@site.copy.about.methodTitle:You should not have to become a pool expert.`,
    methodBody: $localize`:@@site.copy.about.methodBody:We explain the choices and what affects the cost, then plan and build the solution for your property. At handover, we show you how to care for it.`,
    teamTitle: $localize`:@@site.copy.about.teamTitle:The team behind the water`,
  },
  configure: {
    title: $localize`:@@site.copy.configure.title:Find out what suits your garden.`,
    ingress: $localize`:@@site.copy.configure.ingress:In a first phone conversation, we discuss your ideas, your property and how to move forward. The call is free.`,
    nonBinding: $localize`:@@site.copy.configure.nonBinding:This is a starting point, not a quotation. We assess the site and agree the scope with you before quoting.`,
    packageTitle: $localize`:@@site.copy.configure.packageTitle:Interested in a pool option?`,
    name: $localize`:@@site.copy.configure.name:Name`,
    email: $localize`:@@site.copy.configure.email:Email`,
    phone: $localize`:@@site.copy.configure.phone:Phone`,
    location: $localize`:@@site.copy.configure.location:Town or postcode`,
    emailError: $localize`:@@site.copy.configure.emailError:Enter a valid email address.`,
    none: $localize`:@@site.copy.configure.none:None selected`,
  },
  common: {
    from: $localize`:@@site.copy.common.from:From`,
    inclVat: $localize`:@@site.copy.common.inclVat:incl. VAT`,
    familyPackage: $localize`:@@site.copy.common.familyPackage:For family swimming`,
    viewPackage: $localize`:@@site.copy.common.viewPackage:Enquire about this pool`,
    talkTitle: $localize`:@@site.copy.common.talkTitle:Find out what suits your garden.`,
    talkBody: $localize`:@@site.copy.common.talkBody:A nature pool, a pond or the beginning of an idea. Tell us about the site and what you have in mind.`,
    talkButton: $localize`:@@site.copy.common.talkButton:Request a consultation`,
    guideLabel: $localize`:@@site.copy.common.guideLabel:Guide`,
  },
} as const satisfies FaunapoolenSiteCopy;

export const FAUNAPOOLEN_PROCESS = [
  {
    number: '01',
    title: $localize`:@@site.process.0.title:A first conversation`,
    body: $localize`:@@site.process.0.body:We discuss how you want to use the garden, your budget and the next step. The first phone consultation is free.`,
  },
  {
    number: '02',
    title: $localize`:@@site.process.1.title:Proposal and quotation`,
    body: $localize`:@@site.process.1.body:After assessing the site, we develop the design and quotation. Site visits are charged; the fee is credited against installation if you go ahead.`,
  },
  {
    number: '03',
    title: $localize`:@@site.process.2.title:Construction and handover`,
    body: $localize`:@@site.process.2.body:We build the agreed design, start the system and show you how to care for it.`,
  },
] as const;
