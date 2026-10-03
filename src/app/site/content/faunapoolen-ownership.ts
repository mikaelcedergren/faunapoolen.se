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
  guaranteeTitle: $localize`:@@site.aftercare.guarantee.title:Your guarantees`,
  guaranteeBody: $localize`:@@site.aftercare.guarantee.body:Your pool comes with a five-year guarantee on our installation work and three years on pumps and equipment. The pool liner is covered against manufacturing defects for 20 years.`,
  items: [
    {
      title: $localize`:@@site.aftercare.handover.title:A personal handover`,
      body: $localize`:@@site.aftercare.handover.body:We start the system together and practise the regular care tasks with you. You receive a care plan for your pool, covering the equipment, planting and each season.`,
    },
    {
      title: $localize`:@@site.aftercare.followup.title:We come back`,
      body: $localize`:@@site.aftercare.followup.body:At handover, we book your included first-season site visit. We check circulation, equipment and plant establishment, make the commissioning adjustments needed and answer your questions.`,
    },
  ],
  terms: $localize`:@@site.aftercare.terms:Cover starts at handover. Workmanship covers installation defects; equipment and liner cover follow their product terms. Normal wear, frost damage and damage caused by missed care instructions are excluded. One first-season visit and commissioning adjustments are included; cleaning, routine servicing and later visits are quoted separately. Full terms accompany your quotation.`,
} as const;
