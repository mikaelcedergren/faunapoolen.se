import type { PublicPage } from '../../../../server/src/public-routes';

export const PAGE_SEO: Record<PublicPage, { title: string; description: string }> = {
  home: {
    title: $localize`:@@seo.home.title:Nature pools in Sweden and Denmark | Faunapoolen`,
    description: $localize`:@@seo.home.description:Nature pool design and construction throughout the EU, primarily in Sweden and Denmark. Explore a completed Gotland pool, compare packages and plan your project.`,
  },
  'nature-pools': {
    title: $localize`:@@seo.nature-pools.title:Build a nature pool – design and construction | Faunapoolen`,
    description: $localize`:@@seo.nature-pools.description:Your own nature pool, designed and built by a Certified Aquascape Contractor. See a completed project, compare starting prices and request a free first phone consultation.`,
  },
  pricing: {
    title: $localize`:@@seo.pricing.title:Nature pool prices – compare packages | Faunapoolen`,
    description: $localize`:@@seo.pricing.description:Compare nature pool packages, swimming areas and starting prices excluding VAT and shipping. Find out what affects the cost and what needs assessing before a quotation.`,
  },
  gotland: {
    title: $localize`:@@seo.gotland.title:Nature pool on Gotland – Brita’s garden | Faunapoolen`,
    description: $localize`:@@seo.gotland.description:Photographs and films of the nature pool we built in southern Gotland. Brita shares her experience of the build and family life beside the water.`,
  },
  waterscapes: {
    title: $localize`:@@seo.waterscapes.title:Garden ponds, streams and waterfalls | Faunapoolen`,
    description: $localize`:@@seo.waterscapes.description:Garden ponds, koi ponds, streams, waterfalls, fountains and rainwater harvesting, designed and built with Aquascape systems. Explore options for your garden.`,
  },
  guides: {
    title: $localize`:@@seo.guides.title:Nature pool guides: planning, filtration and care | Faunapoolen`,
    description: $localize`:@@seo.guides.description:Read about planning a nature pool, biological filtration and care. Find answers for your project, then explore pool packages and current prices.`,
  },
  about: {
    title: $localize`:@@seo.about.title:About Faunapoolen – nature pool design and construction`,
    description: $localize`:@@seo.about.description:Meet the team behind Faunapoolen. We design, build and care for nature pools throughout the EU, with a focus on Sweden and Denmark.`,
  },
  cookies: {
    title: $localize`:@@seo.cookies.title:Cookies and your privacy choices | Faunapoolen`,
    description: $localize`:@@seo.cookies.description:Learn how Faunapoolen uses cookies and browser storage, what optional tracking involves, and how to change or withdraw your consent.`,
  },
  faq: {
    title: $localize`:@@seo.faq.title:Frequently asked questions about nature pools | Faunapoolen`,
    description: $localize`:@@seo.faq.description:Answers about space, cost, biological filtration and nature pool care. Learn about consultations and how a project with Faunapoolen begins.`,
  },
  configure: {
    title: $localize`:@@seo.configure.title:Nature pool consultation – contact Faunapoolen`,
    description: $localize`:@@seo.configure.description:Tell us about your garden and your ideas. Choose a pool package or leave the decision open. The first telephone consultation is free.`,
  },
  skane: {
    title: $localize`:@@seo.skane.title:Nature pools in Skåne – design and construction | Faunapoolen`,
    description: $localize`:@@seo.skane.description:Plan a nature pool in Skåne, from swimming space to terraces and ground levels. Compare packages and find out what to discuss with your municipality.`,
  },
  halland: {
    title: $localize`:@@seo.halland.title:Nature pools in Halland – design and construction | Faunapoolen`,
    description: $localize`:@@seo.halland.description:Nature pool design and construction in Halland. Plan water supply and filling, explore pool packages and discuss the conditions in your garden.`,
  },
  blekinge: {
    title: $localize`:@@seo.blekinge.title:Nature pools in Blekinge – design and construction | Faunapoolen`,
    description: $localize`:@@seo.blekinge.description:Planning a nature pool in Blekinge? Explore packages, site access and the questions to raise for coastal or protected properties before construction.`,
  },
  smaland: {
    title: $localize`:@@seo.smaland.title:Nature pools in Småland – design and construction | Faunapoolen`,
    description: $localize`:@@seo.smaland.description:Plan a nature pool in Småland with swimming space, filtration and garden access considered together. Check buried services and compare pool packages.`,
  },
};
