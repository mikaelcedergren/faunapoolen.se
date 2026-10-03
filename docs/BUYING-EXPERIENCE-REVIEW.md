# Buying experience: content for owner review

3 October 2026. Local redesign on `codex/redesign`; not approved for publication.

The owner requested realistic provisional figures without placeholder labels in the
visible design, to give the team concrete wording to correct. The following are
**unverified proposals**, not confirmed company commitments:

- Five-year installation guarantee and two-year equipment guarantee.
- Coverage from handover, exclusions for wear, frost damage and missed care instructions.
- Included telephone follow-up during the first swimming season; visits and service quoted separately.
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
