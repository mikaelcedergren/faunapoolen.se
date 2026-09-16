import type { PublicPage } from '../../../../server/src/public-routes';

export const PAGE_SEO: Record<PublicPage, { title: string; description: string }> = {
  home: {
    title: $localize`:@@seo.home.title:Nature pools in Sweden | Faunapoolen`,
    description: $localize`:@@seo.home.description:Nature pools for gardens across Sweden and Denmark. Compare pool packages and explore local advice for Skåne, Halland, Blekinge and Småland.`,
  },
  'nature-pools': {
    title: $localize`:@@seo.nature-pools.title:Build a nature pool – design and construction | Faunapoolen`,
    description: $localize`:@@seo.nature-pools.description:A nature pool designed for your garden. Explore space, biological filtration and care, compare packages and see how we help from first idea to finished pool.`,
  },
  pricing: {
    title: $localize`:@@seo.pricing.title:Nature pool prices – compare packages | Faunapoolen`,
    description: $localize`:@@seo.pricing.description:Compare nature pool packages, swimming areas and starting prices including VAT. Find out what affects the cost and what needs assessing before a quotation.`,
  },
  projects: {
    title: $localize`:@@seo.projects.title:Nature pool projects and inspiration | Faunapoolen`,
    description: $localize`:@@seo.projects.description:Explore Faunapoolen’s completed nature pool on Gotland and hear Brita’s story. See how swimming, natural stone and a garden come together in a real project.`,
  },
  gotland: {
    title: $localize`:@@seo.gotland.title:Nature pool on Gotland – Brita’s garden | Faunapoolen`,
    description: $localize`:@@seo.gotland.description:Photographs and films of the nature pool we built in southern Gotland. Brita shares her experience of the build and family life beside the water.`,
  },
  waterscapes: {
    title: $localize`:@@seo.waterscapes.title:Garden ponds, streams and waterfalls | Faunapoolen`,
    description: $localize`:@@seo.waterscapes.description:We design and build ponds, streams and waterfalls for your garden. Explore the options and discuss the site, care and your ideas with us.`,
  },
  guides: {
    title: $localize`:@@seo.guides.title:Nature pool guides: planning, filtration and care | Faunapoolen`,
    description: $localize`:@@seo.guides.description:Read about planning a nature pool, biological filtration and care. Find answers for your project, then explore pool packages and current prices.`,
  },
  about: {
    title: $localize`:@@seo.about.title:About Faunapoolen – nature pool design and construction`,
    description: $localize`:@@seo.about.description:Meet Faunapoolen and learn how we approach design, construction and care. We build nature pools across Sweden and welcome projects in Denmark.`,
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
    description: $localize`:@@seo.skane.description:Planning a nature pool in Skåne? Explore pool packages, site questions and the first steps towards a pool designed for your garden.`,
  },
  halland: {
    title: $localize`:@@seo.halland.title:Nature pools in Halland – design and construction | Faunapoolen`,
    description: $localize`:@@seo.halland.description:Planning a nature pool in Halland? Explore pool packages, site questions and the first steps towards a pool designed for your garden.`,
  },
  blekinge: {
    title: $localize`:@@seo.blekinge.title:Nature pools in Blekinge – design and construction | Faunapoolen`,
    description: $localize`:@@seo.blekinge.description:Planning a nature pool in Blekinge? Explore pool packages, site questions and the first steps towards a pool designed for your garden.`,
  },
  smaland: {
    title: $localize`:@@seo.smaland.title:Nature pools in Småland – design and construction | Faunapoolen`,
    description: $localize`:@@seo.smaland.description:Planning a nature pool in Småland? Explore pool packages, site questions and the first steps towards a pool designed for your garden.`,
  },
};
