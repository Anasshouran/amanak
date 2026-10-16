# ADR-0012: Sidebar Upgrade Call-to-Action (P17.1)

## Status

Implemented.

## Context

P17.1 redesigns the sidebar and header. The previous "Plans" navigation link was
removed from the primary nav to keep the personal section focused on day-to-day
security tasks. Billing-monetisation still needs a visible entry point for users
who are not on a paid plan.

## Decisions

1. **Placement**: The upgrade call-to-action lives in the sidebar directly below
   the brand lockup (rather than the previous bottom-of-sidebar slot), giving it
   consistent prominence above the scrolling navigation region.

2. **Visibility**: Rendered only for non-staff users on the **free** plan. The
   `Layout` computes this with `useIsProPlan()` (which reads
   `GET /billing/subscription/` and checks `plan.id !== "free"`) and passes
   `showUpgrade` to `Nav`. While the subscription is loading or on error the CTA
   stays hidden, so paid users never see a stale upsell.

3. **Destination**: The CTA navigates to `/plans` (the existing `Pricing` route).
   It is rendered with the design-system `Button` plus an `IconSparkles` glyph.

4. **Copy / i18n**: New keys `nav.upgrade.title`, `nav.upgrade.subtitle`, and
   `nav.upgrade.action` in both English and Arabic. The earlier
   `sidebar.upgrade.*` keys were removed. The word "Upgrade" is retained in the
   English copy so existing billing end-to-end expectations still match.

5. **Icon rail**: Below `1024px` the sidebar collapses to an icon rail and the
   upgrade card is hidden along with the other text affordances.

## Consequences

- Adds one `GET /billing/subscription/` request per authenticated layout mount.
- `Nav` gains a `showUpgrade` prop (defaults to `true`) so the design component
  stays free of app/auth state; `Layout` owns the plan lookup.
