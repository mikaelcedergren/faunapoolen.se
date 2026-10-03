# Buying experience: content for owner review

3 October 2026. Local redesign on `codex/redesign`; not approved for publication.

The owner requested realistic provisional figures without placeholder labels in the
visible design, to give the team concrete wording to correct. The following are
**unverified proposals**, not confirmed company commitments:

- Five-year installation guarantee, three-year equipment guarantee and a 20-year
  liner guarantee against manufacturing defects.
- Coverage from handover, exclusions for wear, frost damage and missed care instructions.
- One included first-season site visit, booked at handover, covering circulation,
  equipment, plant establishment and commissioning adjustments. Cleaning, routine
  service and later visits are quoted separately.
- About 30 minutes of weekly care during the swimming season.
- Circulation electricity of about SEK 230–460/month excluding VAT, based on 200–400 W operating
  continuously for 30 days at SEK 1.60/kWh excluding VAT (230.40–460.80 SEK before rounding).
- Typical construction time of 3–6 weeks, excluding planning and permits.

Confirm or replace these in `src/app/site/content/faunapoolen-ownership.ts` and the
Swedish/Danish catalogues before any public release. No public publication was requested.

The owner-confirmed net package prices remain 430,000 / 1,100,000 / 4,400,000 SEK.
All public prices and cost examples exclude VAT, as requested by the owner on 3 October 2026.
Package prices also exclude shipping; the public display uses the net package amounts directly.
The site uses one calculation for comparisons, hero prices and enquiry choices.

Package artwork is conceptual, generated from the existing homepage architectural
illustration. It does not document a completed installation or a construction plan.

## Package scope and aftercare meeting proposal

The owner explicitly authorised plausible invented facts for the internal site review
on 3 October 2026. These are visible as ordinary customer copy in the local redesign;
they are not verified commitments or approved for publication.

| Package       | Existing swim area | Proposed swimming depth                    | Proposed total footprint |
| ------------- | ------------------ | ------------------------------------------ | ------------------------ |
| Daily dips    | From 17.5 m²       | 1.2 m                                      | Approximately 30–40 m²   |
| Swim together | From 24 m²         | 1.5 m (already in the package description) | Approximately 45–60 m²   |
| More room     | From 100 m²        | 1.5–1.8 m                                  | Approximately 160–200 m² |

Footprints include the swimming area, filtration and edges for the starting-size
examples; surrounding terraces and wider garden work are additional. Confirm these
ranges with the design/build team. Pools between the displayed sizes are offered.
Live catalogue prices and titles are unchanged.

Proposed standard starting-price scope: design and project coordination; excavation
in accessible soil without rock; liner, filtration, pumps and pipework; installation,
stone edges and aquatic planting; start-up, personal handover and the first-season visit.

Proposed separately itemised costs: rock excavation, groundwater work, restricted
access, surplus-soil removal/disposal, electrical supply, water filling, transport,
decks, terraces and landscaping beyond the pool. Faunapoolen coordinates excavation,
deliveries and the electrician even where costs are site-specific. The quotation
agrees those costs before construction.

Confirm the warranty periods, covered products, exclusions and remedies with the team
and suppliers. The 20-year liner proposal covers manufacturing defects, not a promise
that every cause of leakage is covered for 20 years. Confirm the operational cost and
scheduling of the included site visit, commissioning adjustments and hands-on handover.
The previous phone-only follow-up and blanket two-year equipment draft are superseded.

Editing owners: package dimensions in `faunapoolen-content.ts`; scope in
`faunapoolen-commercial.ts`; aftercare in `faunapoolen-ownership.ts`, all under
`src/app/site/content/`, with Swedish/Danish catalogues alongside the English source.

## Pool comparison cards

On 3 October 2026 the owner approved replacing the provisional 20–30% / 75% / 90%
comparison with three standalone fact cards: about 30% more to build, about 50% less
to run, and 30–60 minutes of weekly care, with additional seasonal maintenance.
These are synthesis estimates from overseas supplier guidance, not measured Swedish
averages or Faunapoolen customer results. The owner subsequently requested removal of
the visible indicative-estimates note; the research limitations remain recorded here.

Research reviewed on 3 October 2026:

- [Fluidra](https://www.fluidra.com/commercial-solutions/inspiration/blog/natural-swimming-pools/)
  gives 20–40% higher initial cost and 30–50% lower operating costs, primarily in a
  commercial-pool context. About 30% is the midpoint of its installation range.
- [Lume](https://www.lume-pools.com/) quotes annual costs of £300–600 versus £800–1,500;
  comparing range midpoints gives about 61% lower costs. About 50% is an indicative
  synthesis with Fluidra, not a statistical average or a like-for-like Swedish study.
- [Big Ditch](https://www.bigditch.com.au/the-trouble-with-natural-swimming-pools/)
  gives 30–60 minutes of weekly growing-season maintenance, plus seasonal work.
  [Lume's maintenance guide](https://www.lume-pools.com/blog/natural-pool-maintenance-guide)
  gives a lower 15–30 minutes. No percentage reduction in care time is claimed.

The source is `POOL_COST_COMPARISON` in `src/app/site/content/faunapoolen-commercial.ts`,
with Swedish/Danish translations. The cards use the standard framework card component's
opacity-low fill and its public 32px border-radius option, with editorial body text.
The indicative-estimate note was removed at the owner's request. The card styling replaces
the initial surface-alt article treatment following the owner's visual correction.
No framework internals or token values are overridden. No public publication was requested.
