// Swedish customer wording is preserved verbatim from faunapoolen.se, retrieved
// 2026-09-12. English and Danish translate the same customer review.
export const FAUNAPOOLEN_TESTIMONIALS = [
  {
    id: 'brita-build',
    author: 'Brita',
    context: $localize`:@@site.testimonials.brita-build.context:Nature pool on southern Gotland`,
    quote: $localize`:@@site.testimonials.brita-build.quote:Faunapoolen has built a wonderfully beautiful nature pool that fits perfectly into the surroundings of my house on southern Gotland. They have been very friendly and professional and have handled the challenges that arose during the process in a way that inspired confidence.`,
  },
  {
    id: 'brita-life',
    author: 'Brita',
    context: $localize`:@@site.testimonials.brita-life.context:On life with the nature pool`,
    quote: $localize`:@@site.testimonials.brita-life.quote:We have really enjoyed the pool, and the grandchildren loved it too and used it a lot.`,
  },
] as const;

export const AQUASCAPE_REFERENCES = {
  certification:
    'https://www.aquascapeinc.com/professionals/become_a_certified_aquascape_contractor',
  technology: 'https://www.aquascapeinc.com/recreational-ponds',
  video: 'https://www.youtube.com/watch?v=cSLnpbmvR3k',
} as const;

// These are Aquascape network examples, never Faunapoolen portfolio entries.
export const AQUASCAPE_PROJECTS = [
  {
    name: 'Aquascape Signature Pond',
    location: $localize`:@@site.aquascape_projects.0.location:St. Charles, Illinois, USA`,
    builder: $localize`:@@site.aquascape_projects.0.builder:Aquascape and participating contractors, led by Ed Beaulieu`,
    body: $localize`:@@site.aquascape_projects.0.body:A pond at Aquascape’s headquarters, built together with contractors from across North America.`,
    source: 'https://www.aquascapeinc.com/signature-pond',
  },
  {
    name: 'Fontana Ponds & Water Features',
    location: $localize`:@@site.aquascape_projects.1.location:Canada`,
    builder: $localize`:@@site.aquascape_projects.1.builder:Diego Asturias and Dan Peterson, Fontana Ponds & Water Features`,
    body: $localize`:@@site.aquascape_projects.1.body:A recreational pond with a zipline across the water, featured in Aquascape’s profile of its 2021 Artists of the Year.`,
    source: 'https://www.aquascapeinc.com/artist-of-the-year',
  },
] as const;

export const FAUNAPOOLEN_EVIDENCE_COPY = {
  certification: $localize`:@@site.evidence_copy.certification:Faunapoolen is Aquascape certified`,
  certificationBody: $localize`:@@site.evidence_copy.certificationBody:We plan and build your pool using Aquascape technology, and help you maintain it.`,
  certificationDetail: $localize`:@@site.evidence_copy.certificationDetail:Aquascape’s Certified Aquascape Contractor programme provides training in building and maintaining water features. We use its technology and take responsibility for your project.`,
  certificationLink: $localize`:@@site.evidence_copy.certificationLink:About certification at Aquascape`,
  technologyLine: $localize`:@@site.evidence_copy.technologyLine:With biological filtration from Aquascape`,
  packageBrand: $localize`:@@site.evidence_copy.packageBrand:A package by Faunapoolen`,
  technologyEyebrow: $localize`:@@site.evidence_copy.technologyEyebrow:The technology behind the water`,
  technologyTitle: $localize`:@@site.evidence_copy.technologyTitle:How the water stays clear.`,
  technologyBody: $localize`:@@site.evidence_copy.technologyBody:Pumps circulate the water, filters catch debris and microorganisms remove nutrients that can feed algae. We size the Aquascape system for your pool, using biological filtration without chlorine.`,
  technologyCare: $localize`:@@site.evidence_copy.technologyCare:Remove leaves and debris, and check the water level and circulation. You receive a plan showing what needs to be done throughout the year.`,
  video: $localize`:@@site.evidence_copy.video:Watch Aquascape’s film on YouTube`,
  videoCaption: $localize`:@@site.evidence_copy.videoCaption:Aquascape`,
  technologyLink: $localize`:@@site.evidence_copy.technologyLink:Explore the system at Aquascape`,
  networkTitle: $localize`:@@site.evidence_copy.networkTitle:Water features in the Aquascape network`,
  networkBody: $localize`:@@site.evidence_copy.networkBody:See how other builders use Aquascape technology in these two projects.`,
  builder: $localize`:@@site.evidence_copy.builder:Built by`,
  source: $localize`:@@site.evidence_copy.source:View the project at Aquascape`,
  caseEyebrow: $localize`:@@site.evidence_copy.caseEyebrow:Completed by Faunapoolen`,
  caseTitle: $localize`:@@site.evidence_copy.caseTitle:Nature pool on Gotland`,
  caseBody: $localize`:@@site.evidence_copy.caseBody:Explore a nature pool on Gotland through photographs and films of the finished setting.`,
  caseLink: $localize`:@@site.evidence_copy.caseLink:See the Gotland pool`,
  customers: $localize`:@@site.evidence_copy.customers:In our customers’ words`,
  included: $localize`:@@site.evidence_copy.included:Included`,
  noCare: $localize`:@@site.evidence_copy.noCare:No annual maintenance selected`,
} satisfies Record<string, string | readonly { title: string; body: string }[]>;
