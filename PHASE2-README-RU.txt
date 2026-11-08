ZELPX PHASE 2 — LOCATION-BASED LEAD MATCHING
================================================

This is a PREPARATION copy. No changes have been applied to production GitHub,
Vercel, or Supabase.

Included:
- supabase-phase2-location-matching.sql
- Contractor portal updates to pass ZIP-centroid coordinates into the new
  admin lead-publishing RPC overloads.
- Customer request form now requires street address, city, 2-letter state,
  and 5-digit US ZIP; it looks up ZIP centroid coordinates using
  api.zippopotam.us.
- Admin request review pre-fills the customer's submitted city/state/ZIP.

IMPORTANT TECHNICAL NOTES:
1. Apply Phase 1 and Phase 2 SQL only to a separate STAGING Supabase project
   after reviewing the migration and verifying the app points to staging.
2. Phase 2 tightens lead SELECT access: contractors can see only leads whose
   ZIP matches, whose ZIP-centroid distance is within their radius, or whose
   city+state match when coordinates are unavailable. Admins retain access.
3. buy_lead() also checks the service area on the server. A contractor cannot
   buy a lead outside the registered area by guessing its ID.
4. ZIP centroid distance is approximate, not rooftop-accurate. A trusted ZIP
   centroid dataset or geocoding provider should be used before relying on
   precise dispatch or travel distance.
5. Lead notifications are NOT implemented in this phase. The current phase
   restricts which leads appear and may be purchased. Email/push notifications
   require a separate Edge Function + delivery provider and user preferences.
6. Existing leads have no coordinates until backfilled. They match only by
   exact ZIP or exact city+state fallback.
7. Service-category preferences are not currently stored per contractor, so
   matching is geographic only. Add service categories to contractor profiles
   before enabling skill-based matching.
8. The legacy admin RPC functions remain in place for compatibility. The
   updated portal calls the new coordinate-aware overloads.

TEST PLAN FOR STAGING:
- Register test contractors in different ZIP codes and set different radii.
- Create test leads with known ZIPs.
- Confirm same-ZIP leads appear.
- Confirm leads inside radius appear and leads outside radius do not.
- Confirm admin can see all leads.
- Confirm contractor cannot purchase outside-area lead by calling buy_lead().
- Confirm lead contact details remain behind existing purchase/contact RPC.
- Test city/state fallback for records without coordinates.
