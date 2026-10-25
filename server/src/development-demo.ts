/** Explicit local design fixtures. Never imported by either runtime entrypoint. */
import type { SyncSqliteDatabase } from '@mikaelcedergren/cx-framework/server/sqlite';
import { createCampaignRepository } from './campaign-repository.js';
import {
  validateCampaignRecord,
  type CampaignCopy,
  type CampaignRecord,
} from './campaign-schema.js';
import { COPY_FIELD_IDS } from './copy-budgets.js';
import { createEnquiryService } from './enquiry-service.js';
import { IMAGE_CONCEPTS } from './image-style.js';
import { socialVariant, type SocialMedia } from './social-contracts.js';
import { createSocialService } from './social-service.js';

export const demoId = (group: number, index: number) =>
  `d3a00000-0000-4000-8000-${String(group * 1000 + index).padStart(12, '0')}`;

const customers = [
  [
    'Sofia Lind',
    'sofia',
    'Lund, Skåne',
    'A place for the family to swim, with planting around the edges.',
    'new',
    'lead',
  ],
  [
    'Erik Berg',
    'erik',
    'Varberg, Halland',
    'We have an open lawn beside the terrace and would like to understand the options.',
    'contacted',
    'lead',
  ],
  [
    'Maja Holm',
    'maja',
    'Visby, Gotland',
    'A small pool beside our cottages. The ground is stony and access needs a site visit.',
    'closed',
    'customer',
  ],
  [
    'Jonas Ek',
    'jonas',
    'Karlskrona, Blekinge',
    'Could a pond and a small waterfall fit into the lower part of our garden?',
    'new',
    'lead',
  ],
  [
    'Freja Nielsen',
    'freja',
    'Roskilde, Denmark',
    'We would like space for swimming and a quiet seating area beside the water.',
    'contacted',
    'customer',
  ],
  [
    'Nora Andersson',
    'nora',
    'Växjö, Småland',
    'We are early in planning and would like advice on the right size for our garden.',
    'closed',
    'lead',
  ],
] as const;

const campaignIdeas = [
  [
    'Demo · A garden to swim in',
    'Help a family imagine a swimming place that belongs in their garden.',
    'strategy',
  ],
  [
    'Demo · Plan next summer',
    'Invite homeowners to start planning a natural pool with a conversation about their site.',
    'copy',
  ],
  [
    'Demo · Water beside the terrace',
    'Show how a place to swim can become part of everyday life beside the house.',
    'complete',
  ],
  [
    'Demo · A quieter corner',
    'Introduce a garden pond as a place to sit, watch the water and unwind.',
    'complete',
  ],
] as const;

function copy(swedish: boolean, pond: boolean): CampaignCopy {
  const headline = swedish
    ? pond
      ? 'En lugn plats i trädgården'
      : 'Bada hemma i trädgården'
    : pond
      ? 'A quieter garden corner'
      : 'Swim in your own garden';
  const primaryText = swedish
    ? 'Utgå från trädgården du har. Vi hjälper dig att utforska möjligheterna med vatten, natursten och växter.'
    : 'Start with the garden you have. Explore the possibilities of water, natural stone and planting with us.';
  return {
    headline,
    primaryText,
    description: swedish ? 'Vatten hemma' : 'Natural pools',
    fullCaption: swedish
      ? `${primaryText}\n\nBerätta hur platsen ser ut och hur du vill använda den. Tillsammans tar vi första steget mot en plan som passar din trädgård.`
      : `${primaryText}\n\nTell us about your space and how you would like to use it. Together, we can take the first step towards a plan that suits your garden.`,
    callToAction: swedish ? 'Berätta om din trädgård' : 'Tell us about your garden',
    hashtags: swedish
      ? ['#trädgård', '#naturpool', '#vatten']
      : ['#gardendesign', '#naturalpool', '#watergarden'],
    variations: {
      headline: swedish
        ? ['En plats för vatten', 'Njut av trädgården', 'Börja med en idé']
        : ['Make room for water', 'Enjoy your garden', 'Start with an idea'],
      primaryText: swedish
        ? [
            'Låt vattnet bli en del av trädgården.',
            'Skapa plats för lugna stunder hemma.',
            'Vi hjälper dig att utforska möjligheterna.',
          ]
        : [
            'Let water become part of your garden.',
            'Make space for quiet moments at home.',
            'We help you explore the possibilities.',
          ],
    },
    rationale: COPY_FIELD_IDS.map((field) => ({
      field,
      ruleIds: ['outcome-first'],
      guidance: 'Describe the experience the reader wants, then offer one clear next step.',
    })),
  };
}

export function demoCampaign(index: number): CampaignRecord {
  const [name, idea, stage] = campaignIdeas[index]!;
  const timestamp = `2026-10-${String(14 + index).padStart(2, '0')}T09:00:00.000Z`;
  return validateCampaignRecord({
    id: demoId(2, index),
    name,
    idea,
    stage,
    createdAt: timestamp,
    updatedAt: timestamp,
    strategy: {
      name,
      audience: 'Homeowners who want water to feel like a natural part of their garden.',
      desiredOutcome: 'A clear first conversation about what could work on their site.',
      singleMessage:
        index === 3
          ? 'Make a quiet place for water in the garden you already have.'
          : 'Make a place to swim in the garden you already have.',
      externalProblem:
        'The homeowner has space but no clear plan for bringing water into the garden.',
      internalProblem: 'They are unsure where to start or what will suit their site.',
      plan: ['Tell us about your garden', 'Explore the possibilities', 'Plan the next step'],
      assumptions: ['This is fictional local design content, not a customer campaign.'],
      rationale: [
        {
          topic: 'audience',
          ruleIds: ['hero-is-customer'],
          why: 'The homeowner and their garden are the starting point.',
        },
        {
          topic: 'desiredOutcome',
          ruleIds: ['outcome-first'],
          why: 'The first conversation is a concrete, manageable outcome.',
        },
        {
          topic: 'singleMessage',
          ruleIds: ['one-promise'],
          why: 'Keep the message focused on one change to everyday life.',
        },
      ],
    },
    copy: stage === 'strategy' ? {} : { en: copy(false, index === 3), sv: copy(true, index === 3) },
    imagePrompts:
      stage !== 'complete'
        ? []
        : IMAGE_CONCEPTS.map((concept) => ({
            concept: concept.id,
            label: concept.label,
            prompt:
              'Candid garden photography in soft natural daylight. An irregular pool edge of natural stone, recognisable water texture and relaxed planting beside a timber terrace. Restrained colour and believable reflections. No text, logos or graphic overlays.',
            altText: 'Water and natural stone beside a planted garden terrace.',
            ruleIds: ['photo-not-poster'],
            why: 'A recognisable garden scene makes the idea concrete without adding a second message.',
          })),
  });
}

export interface DemoMedia {
  bytes: Buffer;
  metadata: SocialMedia;
}

/** Adds missing fixtures only: existing drafts, statuses, prices and media are never overwritten. */
export function seedDevelopmentDemo(database: SyncSqliteDatabase, media: readonly DemoMedia[]) {
  if (media.length < 2) throw new Error('The demo needs two local sample images.');
  const enquiries = createEnquiryService({
    database,
    secret: 'local-demo-fixtures-only',
    executionScope: 'development',
  });
  const campaigns = createCampaignRepository(database);
  const posts = createSocialService(database);
  const added = { enquiries: 0, campaigns: 0, posts: 0 };
  for (let index = 0; index < 8; index++) {
    const entry = customers[index % customers.length]!;
    const [name, email, location, notes, status, customerStatus] = entry;
    const id = demoId(1, index);
    if (database.get('SELECT id FROM enquiries WHERE id=?', [id])) continue;
    const timestamp = Date.parse(`2026-10-${String(10 + index).padStart(2, '0')}T10:00:00.000Z`);
    const service = createEnquiryService({
      database,
      secret: 'local-demo-fixtures-only',
      executionScope: 'development',
      now: () => timestamp,
    });
    const existingCustomer = database.get('SELECT id FROM customers WHERE email=?', [
      `${email}@example.test`,
    ]);
    service.submit({
      requestId: id,
      name: `${name} (demo)`,
      email: `${email}@example.test`,
      language: 'en',
      formVersion: 'local-demo-v1',
      fields: [
        { id: 'location', label: 'Location', value: location },
        {
          id: 'notes',
          label: 'Your garden',
          value:
            index < 6
              ? notes
              : 'Following up after our first conversation. We can share photographs and arrange a visit to look at access.',
        },
        {
          id: 'timing',
          label: 'When are you planning?',
          value: index % 2 ? 'Exploring ideas for next year' : 'Ready to discuss the next step',
        },
      ],
    });
    // Fictional enquiries have no delivery history and must never queue an email.
    database.run('DELETE FROM enquiry_notifications WHERE enquiry_id=?', [id]);
    if (status !== 'new') service.update(id, { status, expectedRevision: 1 });
    const customer = enquiries.customers().find((c) => c.email === `${email}@example.test`)!;
    if (!existingCustomer && customerStatus === 'customer')
      service.updateCustomer(customer.id, {
        status: customerStatus,
        expectedRevision: customer.revision,
      });
    added.enquiries++;
  }
  for (let index = 0; index < campaignIdeas.length; index++) {
    if (campaigns.get(demoId(2, index))) continue;
    campaigns.create(demoCampaign(index));
    added.campaigns++;
  }
  const existingPosts = new Set(posts.list().map((post) => post.id));
  for (let index = 0; index < 4; index++) {
    const id = demoId(3, index);
    if (existingPosts.has(id)) continue;
    const name = [
      'Demo · A moment by the water',
      'Demo · From garden to swimming place',
      'Demo · Planning starts here',
      'Demo · Stone, water and planting',
    ][index]!;
    const text = [
      'A quiet moment beside the water. Natural stone and planting bring the edge of a pool into the garden around it.',
      'A place to swim can start with the space beside your house. Tell us about your garden and what you would like to make room for.',
      'Thinking about water in your garden? Start with photographs of the space, your ideas and the questions you want to explore.',
      'The details shape how a garden feels: water moving against stone, planting at the edges and a place to pause.',
    ][index]!;
    const platforms = index === 2 ? (['linkedin'] as const) : (['facebook', 'instagram'] as const);
    let post = posts.create(id, {
      name,
      text,
      variants: platforms.map((platform) => socialVariant(platform, text, name, false)),
    });
    if (index !== 2) {
      const image = media[index % media.length]!;
      post = posts.setMedia(id, post.revision, image.bytes, image.metadata);
    }
    if (index === 3)
      posts.update(id, post.revision, {
        name,
        text,
        variants: post.variants.map((variant) => ({ ...variant, published: true })),
      });
    added.posts++;
  }
  return added;
}
