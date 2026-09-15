/** Buying questions and supporting copy shared by the bilingual page compositions. */
export const FAUNAPOOLEN_EDITORIAL = {
  conceptImage: $localize`:@@site.editorial.conceptImage:Illustration of a possible waterscape.`,
  heroAlt: $localize`:@@site.editorial.heroAlt:Concept image: a family beside a nature pool among birch, stone and timber.`,
  architectureAlt: $localize`:@@site.editorial.architectureAlt:Concept image: a view from a timber house towards water and woodland.`,
  waterscapeAlt: $localize`:@@site.editorial.waterscapeAlt:Concept image: a koi pond and a small stream in a leafy garden.`,
  supplierAlt: $localize`:@@site.editorial.supplierAlt:Aquascape’s own example of a recreational pond.`,
  responsibility: $localize`:@@site.editorial.responsibility:From design to construction and care. Faunapoolen brings your project together.`,
  lifeTitle: $localize`:@@site.editorial.lifeTitle:For a swim. And everything in between.`,
  lifeBody: $localize`:@@site.editorial.lifeBody:A nature pool is also part of your garden. We plan the water, edges and planting together with the places where you want to sit, walk and spend time.`,
  lifeLink: $localize`:@@site.editorial.lifeLink:Explore nature pools`,
  customerTitle: $localize`:@@site.editorial.customerTitle:It’s the life around the pool that matters.`,
  britaContext: $localize`:@@site.editorial.britaContext:Brita shares her experience of the build and life with her nature pool on southern Gotland.`,
  casePreview: $localize`:@@site.editorial.casePreview:Explore the finished nature pool through photographs and films from Gotland.`,
  firstContact: $localize`:@@site.editorial.firstContact:Start with Benjamin. Together, you’ll discuss the site, what you have in mind and the right next step.`,
  certificationMeaning: $localize`:@@site.editorial.certificationMeaning:What the certification means`,
  technologyResponsibility: $localize`:@@site.editorial.technologyResponsibility:The technology comes from Aquascape. We select and adapt the system for your site, and show you how to care for it.`,
  technologyDetails: $localize`:@@site.editorial.technologyDetails:How filtration and care work`,
  priceScope: $localize`:@@site.editorial.priceScope:Prices are estimates including VAT. Ground conditions, access and your choices affect the cost. We review the scope with you before preparing a quotation.`,
  discussService: $localize`:@@site.editorial.discussService:Tell us what you have in mind`,
  service: $localize`:@@site.editorial.service:What would you like to create?`,
  unknown: $localize`:@@site.editorial.unknown:Not sure yet`,
  servicePrice: $localize`:@@site.editorial.servicePrice:We’ll assess the cost together`,
  servicePriceBody: $localize`:@@site.editorial.servicePriceBody:Tell us about the site and what you have in mind. You do not need to choose a pool package to begin.`,
  packageHelp: $localize`:@@site.editorial.packageHelp:Packages are a starting point. You can leave the choice open.`,
  optionalChoices: $localize`:@@site.editorial.optionalChoices:Personalise your pool`,
  optionalChoicesBody: $localize`:@@site.editorial.optionalChoicesBody:Choose what you already know. We can work out the rest together.`,
  contactHelp: $localize`:@@site.editorial.contactHelp:Your name, email and location are needed for the brief. Phone and preferred contact time are optional.`,
  notes: $localize`:@@site.editorial.notes:Tell us about your garden and your plans`,
  notesHelp: $localize`:@@site.editorial.notesHelp:For example, how you would like to use the space and when you would like to begin.`,
  review: $localize`:@@site.editorial.review:Review your project brief`,
  estimatePending: $localize`:@@site.editorial.estimatePending:Ground conditions and access still need to be assessed.`,
  videoLink: $localize`:@@site.editorial.videoLink:Watch on YouTube`,
  guideContents: $localize`:@@site.editorial.guideContents:In this guide`,
} satisfies Record<string, string>;

export const FAUNAPOOLEN_SERVICES = [
  { id: 'pool', name: $localize`:@@site.services.pool.name:Nature pool` },
  { id: 'pond', name: $localize`:@@site.services.pond.name:Pond` },
  {
    id: 'stream',
    name: $localize`:@@site.services.stream.name:Stream or waterfall`,
  },
  {
    id: 'unsure',
    name: $localize`:@@site.services.unsure.name:I would like help choosing`,
  },
] as const;
export type FaunapoolenService = (typeof FAUNAPOOLEN_SERVICES)[number]['id'];
