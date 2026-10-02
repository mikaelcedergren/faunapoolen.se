export const NATURE_POOL_LANDING = {
  reassurance: $localize`:@@site.poolLanding.reassurance:Your first phone consultation is free. No finished plan needed.`,
  questionsTitle: $localize`:@@site.poolLanding.questionsTitle:A few answers before we talk.`,
  benefitsIntro: $localize`:@@site.poolLanding.benefitsIntro:You want a place to swim that feels at home in your garden, without the regular chemical treatment of a conventional pool. But it can be hard to know what will fit, what it will cost or where to begin. We help you find a design that suits your space, your budget and the way you want to enjoy the water.`,
  caseBody: $localize`:@@site.poolLanding.caseBody:A finished Faunapoolen project on southern Gotland, designed around the house and garden with natural stone edges and planting.`,
  certificationBody: $localize`:@@site.poolLanding.certificationBody:Aquascape™ certified expertise, from planning and construction to showing you how to care for your pool.`,
  priceIntro: $localize`:@@site.poolLanding.priceIntro:Compare the scale and features, not just the swimming area. You can leave the choice open until we’ve talked about your garden.`,
  scope: $localize`:@@site.poolLanding.scope:Your quotation confirms the full scope, including what is covered for excavation, soil removal, electrical work, filling and transport. We agree this with you before you commit.`,
  steps: [
    {
      number: '01',
      title: $localize`:@@site.poolLanding.steps.0.title:Tell us about your garden`,
      body: $localize`:@@site.poolLanding.steps.0.body:Start with a free phone conversation about your space, budget and ideas. No drawings or package choice needed.`,
    },
    {
      number: '02',
      title: $localize`:@@site.poolLanding.steps.1.title:Choose your design`,
      body: $localize`:@@site.poolLanding.steps.1.body:After a site assessment, review your design and quotation. You decide what goes ahead before construction begins.`,
    },
    {
      number: '03',
      title: $localize`:@@site.poolLanding.steps.2.title:Enjoy your first swim`,
      body: $localize`:@@site.poolLanding.steps.2.body:We build your pool, start the system and show you how to look after it, with a care plan to take with you.`,
    },
  ],
  questions: [
    {
      id: 'timing',
      question: $localize`:@@site.poolLanding.timing.question:How long will the build take?`,
      answer: $localize`:@@site.poolLanding.timing.answer:The schedule depends on the design, ground conditions and access. We discuss your preferred timing and agree a project schedule before work begins, so you know what to expect.`,
    },
    {
      id: 'disruption',
      question: $localize`:@@site.poolLanding.disruption.question:What happens to the rest of my garden?`,
      answer: $localize`:@@site.poolLanding.disruption.answer:Building a pool involves excavation and access for machinery. We discuss which areas will be affected, where soil will go and what finishing work is included, so the agreed scope covers the garden as well as the pool.`,
    },
    {
      id: 'budget',
      question: $localize`:@@site.poolLanding.budget.question:What can change the final price?`,
      answer: $localize`:@@site.poolLanding.budget.answer:Ground conditions, access, filtration, materials and the surrounding garden all affect the cost. The starting prices exclude VAT and shipping; your quotation sets out the work and materials for your property before you decide.`,
    },
  ],
} as const;

export const POOL_ENQUIRY = {
  cta: $localize`:@@site.poolEnquiry.cta:Request free pool advice`,
  heading: $localize`:@@site.poolEnquiry.heading:Let’s find the right pool for your garden.`,
  body: $localize`:@@site.poolEnquiry.body:Tell us where you’d like to build. In your free phone consultation, we’ll discuss what could fit, your budget and the next step.`,
  followUp: $localize`:@@site.poolEnquiry.followUp:We’ll email you to arrange a time. If you’d prefer a call, leave your phone number.`,
  received: $localize`:@@site.poolEnquiry.received:Thank you. We’ll get in touch to arrange your free pool consultation. There’s no commitment to a design or package.`,
} as const;
