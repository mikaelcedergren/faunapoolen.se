import type { GUIDE_SLUGS } from '../../../../server/src/public-routes';
export type { PublicLanguage as FaunapoolenLocale } from '../../../../server/src/public-routes';
export type FaunapoolenPage =
  | 'home'
  | 'nature-pools'
  | 'gotland'
  | 'waterscapes'
  | 'guides'
  | 'about'
  | 'faq'
  | 'cookies'
  | 'configure'
  | 'pricing'
  | 'skane'
  | 'halland'
  | 'blekinge'
  | 'smaland'
  | 'guide';

export type FaunapoolenGuideId = keyof typeof GUIDE_SLUGS;

export interface FaunapoolenPackage {
  readonly id: 'glade' | 'summer' | 'horizon';
  readonly name: string;
  readonly area: string;
  readonly depth: string;
  readonly filtrationSize: string;
  readonly materials: string;
  readonly description: string;
  readonly includes: readonly string[];
  readonly price: number;
}

export const FAUNAPOOLEN_PACKAGES: readonly Omit<FaunapoolenPackage, 'name' | 'price'>[] = [
  {
    id: 'glade',
    area: $localize`:@@site.packages.glade.area:Starting from 2 m × 2.5 m (5 m²)`,
    depth: $localize`:@@site.packages.glade.depth:0.9 m depth`,
    filtrationSize: $localize`:@@site.packages.glade.filtrationSize:Filtration size of 30%`,
    materials: $localize`:@@site.packages.glade.materials:4 tons decorative boulders, 2 tons gravel`,
    description: $localize`:@@site.packages.glade.description:A compact plunge pool with Aquascape biological filtration, for cooling off after the sauna or in a smaller garden.`,
    includes: [
      $localize`:@@site.packages.includes.waterfalls:Waterfall & BioStream integration`,
      $localize`:@@site.packages.glade.includes.0:Aquascape BioFalls filtration`,
      $localize`:@@site.packages.includes.skimmer:Aquascape Signature Series skimmer`,
      $localize`:@@site.packages.glade.includes.1:Aquatic plants for ecosystem balance`,
      $localize`:@@site.packages.glade.includes.2:Custom design for smaller gardens`,
      $localize`:@@site.packages.includes.maintenance:One year of maintenance included`,
    ],
  },
  {
    id: 'summer',
    area: $localize`:@@site.packages.summer.area:Starting from 4 m × 4 m (16 m²)`,
    depth: $localize`:@@site.packages.summer.depth:1.5 m depth`,
    filtrationSize: $localize`:@@site.packages.summer.filtrationSize:Filtration size of 30%`,
    materials: $localize`:@@site.packages.summer.materials:21 tons decorative boulders, 11 tons gravel`,
    description: $localize`:@@site.packages.summer.description:A pool for swimming together, with decorative stone boulders, lighting and circulation jets.`,
    includes: [
      $localize`:@@site.packages.includes.waterfalls:Waterfall & BioStream integration`,
      $localize`:@@site.packages.glade.includes.0:Aquascape BioFalls filtration`,
      $localize`:@@site.packages.includes.skimmer:Aquascape Signature Series skimmer`,
      $localize`:@@site.packages.summer.includes.lighting:Integrated light system`,
      $localize`:@@site.packages.summer.includes.dosing:Aquascape Automatic Dosing System`,
      $localize`:@@site.packages.summer.includes.iongen:Aquascape IonGen system`,
      $localize`:@@site.packages.glade.includes.1:Aquatic plants for ecosystem balance`,
      $localize`:@@site.packages.summer.includes.design:Designs for larger garden areas`,
      $localize`:@@site.packages.includes.maintenance:One year of maintenance included`,
    ],
  },
  {
    id: 'horizon',
    area: $localize`:@@site.packages.horizon.area:Starting from 10 m × 10 m (100 m²)`,
    depth: $localize`:@@site.packages.horizon.depth:1.8 m depth`,
    filtrationSize: $localize`:@@site.packages.horizon.filtrationSize:Filtration size of 30%`,
    materials: $localize`:@@site.packages.horizon.materials:140 tons decorative boulders, 82 tons gravel`,
    description: $localize`:@@site.packages.horizon.description:A spacious pool with waterfalls, decorative stone boulders and a planted landscape.`,
    includes: [
      $localize`:@@site.packages.includes.waterfalls:Waterfall & BioStream integration`,
      $localize`:@@site.packages.horizon.includes.filtration:Aquascape wetland filtration`,
      $localize`:@@site.packages.horizon.includes.skimmer:Intake bay skimmer`,
      $localize`:@@site.packages.summer.includes.lighting:Integrated light system`,
      $localize`:@@site.packages.summer.includes.dosing:Aquascape Automatic Dosing System`,
      $localize`:@@site.packages.summer.includes.iongen:Aquascape IonGen system`,
      $localize`:@@site.packages.glade.includes.1:Aquatic plants for ecosystem balance`,
      $localize`:@@site.packages.horizon.includes.design:Designed for large estates, hotels and retreats`,
      $localize`:@@site.packages.horizon.includes.downspout:Aquascape Downspout Filter for rainwater top-ups`,
      $localize`:@@site.packages.includes.maintenance:One year of maintenance included`,
    ],
  },
] as const;

interface FaunapoolenSiteCopy {
  readonly menuLabel: string;
  readonly start: string;
  readonly nav: {
    readonly home: string;
    readonly naturePools: string;
    readonly pricing: string;
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
    readonly caseBody: string;
    readonly processTitle: string;
    readonly waterscapeEyebrow: string;
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
  readonly waterscapes: {
    readonly eyebrow: string;
    readonly title: string;
    readonly ingress: string;
    readonly typesTitle: string;
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
    readonly companyTitle: string;
    readonly companyBody: string;
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
    readonly priceExclusions: string;
    readonly travelCosts: string;
    readonly familyPackage: string;
    readonly viewPackage: string;
    readonly talkTitle: string;
    readonly talkBody: string;
    readonly guideLabel: string;
  };
}

export const FAUNAPOOLEN_COPY = {
  menuLabel: $localize`:@@site.copy.menuLabel:Faunapoolen menu`,
  start: $localize`:@@site.copy.start:Request a consultation`,
  nav: {
    home: $localize`:@@site.copy.nav.home:Start`,
    naturePools: $localize`:@@site.copy.nav.naturePools:Nature pools`,
    pricing: $localize`:@@site.copy.nav.pricing:Prices`,
    waterscapes: $localize`:@@site.copy.nav.waterscapes:Waterscapes`,
    guides: $localize`:@@site.copy.nav.guides:Guides`,
    about: $localize`:@@site.copy.nav.about:About`,
  },
  home: {
    eyebrow: $localize`:@@site.copy.home.eyebrow:Nature pools for your garden`,
    title: $localize`:@@site.copy.home.title:Make your garden the best part of being home.`,
    ingress: $localize`:@@site.copy.home.ingress:As the only Certified Aquascape Contractor in the northern EU, we design and build nature pools for morning swims, long summer evenings and time together.`,
    primary: $localize`:@@site.copy.home.primary:Request a consultation`,
    secondary: $localize`:@@site.copy.home.secondary:See a completed natural pool`,
    caseBody: $localize`:@@site.copy.home.caseBody:We built this nature pool beside Brita’s home on southern Gotland, with natural boulders that connect it to the surrounding garden. Today, it’s a place for her and her grandchildren to swim and spend time together.`,
    processTitle: $localize`:@@site.copy.home.processTitle:From the first idea to your first swim.`,
    waterscapeEyebrow: $localize`:@@site.copy.home.waterscapeEyebrow:Other waterscapes`,
    waterscapeTitle: $localize`:@@site.copy.home.waterscapeTitle:A place to pause in your own garden.`,
    waterscapeBody: $localize`:@@site.copy.home.waterscapeBody:Watch the fish, listen to a stream or settle beside a quiet pond. From long summer evenings to crisp winter mornings, we create water features to enjoy throughout the year, outdoors or from the warmth of home.`,
  },
  naturePools: {
    eyebrow: $localize`:@@site.copy.naturePools.eyebrow:Nature pools`,
    title: $localize`:@@site.copy.naturePools.title:A natural place to swim. A lovely place to be.`,
    ingress: $localize`:@@site.copy.naturePools.ingress:Clear water, natural stone and planting that belongs in your garden. We bring them together in a nature pool designed for you, from the first ideas to your first swim.`,
    careTitle: $localize`:@@site.copy.naturePools.careTitle:What care does a nature pool need?`,
    careBody: $localize`:@@site.copy.naturePools.careBody:Biological filtration still needs routine care. At handover, we show you the tasks for your system and provide a maintenance plan.`,
    carePoints: [
      $localize`:@@site.copy.naturePools.carePoints.0:Remove leaves and debris, and check water level and circulation.`,
      $localize`:@@site.copy.naturePools.carePoints.1:Care for the plants and follow the seasonal plan for your system.`,
      $localize`:@@site.copy.naturePools.carePoints.2:We also offer servicing, spring start-up and winter preparation.`,
    ],
  },
  waterscapes: {
    eyebrow: $localize`:@@site.copy.waterscapes.eyebrow:Waterscapes`,
    title: $localize`:@@site.copy.waterscapes.title:Your own place to slow down.`,
    ingress: $localize`:@@site.copy.waterscapes.ingress:A pond to spend time beside or a stream within earshot of the terrace. We design and build garden ponds, koi ponds, streams, waterfalls and fountains, with rainwater harvesting options for your garden.`,
    typesTitle: $localize`:@@site.copy.waterscapes.typesTitle:What would you enjoy coming outside for?`,
    methodTitle: $localize`:@@site.copy.waterscapes.methodTitle:Designed for your garden. Planned for care.`,
    methodBody: $localize`:@@site.copy.waterscapes.methodBody:The right choice depends on your space, budget and how much care you want to take on. We plan circulation and filtration, with equipment you can reach for servicing.`,
  },
  guides: {
    title: $localize`:@@site.copy.guides.title:Ideas and guides`,
    ingress: $localize`:@@site.copy.guides.ingress:Explore nature pools, ponds and water gardens, with practical advice on design, natural filtration and everyday care.`,
    read: $localize`:@@site.copy.guides.read:Read the guide`,
  },
  about: {
    eyebrow: $localize`:@@site.copy.about.eyebrow:About Faunapoolen`,
    title: $localize`:@@site.copy.about.title:About Faunapoolen`,
    ingress: $localize`:@@site.copy.about.ingress:We bring construction, business and design together to create nature pools and water gardens. Meet the people behind Faunapoolen.`,
    methodTitle: $localize`:@@site.copy.about.methodTitle:You should not have to become a pool expert.`,
    methodBody: $localize`:@@site.copy.about.methodBody:We explain the choices and what affects the cost, then plan and build the solution for your property. At handover, we show you how to care for it.`,
    teamTitle: $localize`:@@site.copy.about.teamTitle:The team behind the water`,
    companyTitle: $localize`:@@site.copy.about.companyTitle:A Swedish specialist in nature pools`,
    companyBody: $localize`:@@site.copy.about.companyBody:Faunapoolen is a Swedish company designing and building nature pools, ponds and water gardens. We bring water, natural stone and planting together so each project feels part of its surroundings. Our work extends beyond the pool itself, from the surrounding garden to ongoing care as it grows and changes.`,
  },
  configure: {
    title: $localize`:@@site.copy.configure.title:Find out what suits your garden.`,
    ingress: $localize`:@@site.copy.configure.ingress:In a first phone conversation, we discuss your ideas, your property and how to move forward. The call is free.`,
    nonBinding: $localize`:@@site.copy.configure.nonBinding:Your choices are a starting point, not a commitment. We assess the site and agree the scope with you before quoting.`,
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
    priceExclusions: $localize`:@@site.copy.common.priceExclusions:excl. VAT and shipping`,
    travelCosts: $localize`:@@site.copy.common.travelCosts:Travel and accommodation costs depend on your location and may significantly affect the final price.`,
    familyPackage: $localize`:@@site.copy.common.familyPackage:For family swimming`,
    viewPackage: $localize`:@@site.copy.common.viewPackage:Enquire about this pool`,
    talkTitle: $localize`:@@site.copy.common.talkTitle:Find out what suits your garden.`,
    talkBody: $localize`:@@site.copy.common.talkBody:A nature pool, a pond or the beginning of an idea. Tell us about the site and what you have in mind.`,
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
    body: $localize`:@@site.process.1.body:After assessing the site, we develop the design and quotation. The planning visit is charged; its fee is credited against installation if you go ahead.`,
  },
  {
    number: '03',
    title: $localize`:@@site.process.2.title:Construction and handover`,
    body: $localize`:@@site.process.2.body:We build the agreed design, start the system and show you how to care for it.`,
  },
] as const;
