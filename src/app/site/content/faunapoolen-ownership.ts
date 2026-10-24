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
      answer: $localize`:@@site.ownership.care.answer:Around 10 minutes a week in the swimming season.`,
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
      answer: $localize`:@@site.ownership.build.answer:The schedule depends on your pool and site.`,
      detail: $localize`:@@site.ownership.build.detail:Pool size, ground conditions, access and weather affect the time from excavation to handover. Planning and any permits come beforehand. We agree a schedule for your project before construction begins.`,
    },
  ],
} as const;

export const POOL_AFTERCARE = {
  title: $localize`:@@site.aftercare.title:Confidence beyond the first swim.`,
  guaranteeTitle: $localize`:@@site.aftercare.guarantee.title:Clear warranty terms`,
  guaranteeBody: $localize`:@@site.aftercare.guarantee.body:Your quotation sets out the warranty cover for installation work, equipment and the pool liner, including the duration, conditions and any exclusions. You can review these before deciding to go ahead.`,
  items: [
    {
      title: $localize`:@@site.aftercare.handover.title:A personal handover`,
      body: $localize`:@@site.aftercare.handover.body:We start the system together and show you how to care for your pool. You receive a care plan covering the equipment, planting and seasonal tasks.`,
    },
    {
      title: $localize`:@@site.aftercare.followup.title:One year of maintenance`,
      body: $localize`:@@site.aftercare.followup.body:Your pool package includes one year of maintenance. Your quotation sets out the visits and work included, so you know what to expect after handover.`,
    },
  ],
  terms: $localize`:@@site.aftercare.terms:Planning changes around your pool? Speak to us before moving stones, changing materials or altering the installation, so we can explain any effect on its performance and warranty cover.`,
} as const;
