// Provisional figures and terms requested for owner review in the local redesign.
// Confirm against docs/BUYING-EXPERIENCE-REVIEW.md before publication.
export const POOL_OWNERSHIP = {
  title: $localize`:@@site.ownership.title:Life with your pool`,
  intro: $localize`:@@site.ownership.intro:A little care each week, with a clear plan for the seasons. Here is what to expect.`,
  body: $localize`:@@site.ownership.body:Most routine care means clearing leaves, checking the water level and keeping circulation flowing. We show you these tasks at handover and provide a care plan for spring start-up, the swimming season and winter.`,
  items: [
    {
      id: 'care',
      title: $localize`:@@site.ownership.care.title:How much care does it need?`,
      answer: $localize`:@@site.ownership.care.answer:Around 30 minutes a week in the swimming season.`,
      detail: $localize`:@@site.ownership.care.detail:Remove leaves, empty the skimmer and check the water level and circulation. Allow extra time for spring start-up, autumn leaves and winter preparation. Your care plan covers the equipment and planting in your pool.`,
    },
    {
      id: 'power',
      title: $localize`:@@site.ownership.power.title:What does the electricity cost?`,
      answer: $localize`:@@site.ownership.power.answer:About SEK 230–460 a month for circulation, excluding VAT.`,
      detail: $localize`:@@site.ownership.power.detail:Calculated for 200–400 W of circulation running continuously for 30 days at SEK 1.60/kWh, excluding VAT. Your equipment and electricity tariff determine the cost. Heating, lighting, water and servicing are additional.`,
    },
    {
      id: 'build',
      title: $localize`:@@site.ownership.build.title:How long does construction take?`,
      answer: $localize`:@@site.ownership.build.answer:Usually 3–6 weeks on site.`,
      detail: $localize`:@@site.ownership.build.detail:This covers construction from excavation to handover. Planning and any permits come beforehand. Ground conditions, access, weather and the size of your pool affect the schedule, which we agree before work begins.`,
    },
  ],
} as const;

export const POOL_AFTERCARE = {
  title: $localize`:@@site.aftercare.title:Confidence beyond the first swim.`,
  items: [
    {
      title: $localize`:@@site.aftercare.guarantee.title:5 years on installation`,
      body: $localize`:@@site.aftercare.guarantee.body:Our installation carries a five-year guarantee. Pumps and technical equipment carry a two-year guarantee.`,
    },
    {
      title: $localize`:@@site.aftercare.handover.title:A personal handover`,
      body: $localize`:@@site.aftercare.handover.body:We start the system together, show you the regular tasks and leave you with a care plan for your pool.`,
    },
    {
      title: $localize`:@@site.aftercare.followup.title:We stay in touch`,
      body: $localize`:@@site.aftercare.followup.body:A follow-up during your first swimming season is included. You can reach us by phone if questions come up along the way.`,
    },
  ],
  terms: $localize`:@@site.aftercare.terms:The installation guarantee covers defects in our work from the date of handover. Equipment is covered by its applicable product terms. Normal wear, frost damage and damage caused by care that differs from the instructions are excluded. The first-season follow-up is by phone; visits, cleaning and ongoing servicing are quoted separately. Full terms accompany your quotation.`,
} as const;
