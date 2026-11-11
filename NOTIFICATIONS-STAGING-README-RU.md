# ZELPX — isolated push-notification staging

## Environment boundaries
- Supabase staging project: `uxqykfrzowprkemokhfo` (`zelpx-portal`).
- Production Supabase project `zsrnjkndgbchfxibxiyd` (`zelpx-database`) was not modified.
- Production VAPID credentials and push subscriptions were not copied.
- The staging test page uses its own service-worker scope under `/staging-push-test/`; it does not replace the production root service worker or the existing `zelpx-push.js`.

## Implemented
- `supabase-notifications-staging.sql`: minimal test schema, event outbox, eligibility routing, and generic message copy.
- `supabase-notifications-staging-hardening.sql`: atomic outbox claim, retry lock, server-only RLS policies and indexes.
- `supabase-notifications-staging-webhook.sql`: Vault-backed Database Webhook trigger and isolated test-device subscriptions.
- `supabase-functions/dispatch-push-notification/index.ts`: authenticated webhook dispatcher and Web Push sender.
- `supabase-functions/staging-push-test/index.ts`: JWT-authenticated test-device registration, removal and self-test endpoint.
- `staging-push-test/index.html` + `staging-push-test/sw.js`: isolated browser test page and scoped service worker.

## Runtime secrets
Four independent staging-only values are stored encrypted in Supabase Vault:
- `zelpx_push_webhook_secret`
- `zelpx_vapid_public_key`
- `zelpx_vapid_private_key`
- `zelpx_vapid_subject`

The VAPID subject is the public Zelpex website URL. No secret values are stored in GitHub or in the SQL migration files. The runtime RPC `get_push_runtime_secrets()` is executable only by `service_role`.

## Deployed Edge Functions
- `dispatch-push-notification`: ACTIVE, `verify_jwt=false`; it authenticates the database webhook using the high-entropy Vault secret.
- `staging-push-test`: ACTIVE, `verify_jwt=true`; it requires a valid staging Auth user session and only sends a test notification to that user's own registered endpoints.

## Event and security behaviour
1. A new lead creates outbox events only for contractors with `verification_status='verified'` and matching ZIP, valid distance radius, or matching city/state when coordinates are unavailable.
2. New chat messages route to the other conversation participant.
3. Chat push bodies are generic. Message text, phone numbers, addresses and private lead details are never placed in push payloads.
4. Events are deduplicated by event type, source row and recipient.
5. `claim_push_notification` atomically locks each outbox event for five minutes to prevent concurrent duplicate dispatch.
6. Expired push endpoints (404/410) are removed.
7. The public test endpoint checks the JWT and binds each device subscription to the authenticated user. It rejects endpoints outside the supported HTTPS push-service hosts.
8. Direct `anon` and `authenticated` access to the subscription and outbox tables is revoked; the server role is used for writes.

## Verification completed
- Synthetic contractor matching test: two eligible verified contractors received lead outbox events; a verified contractor outside the radius and a pending contractor did not.
- Synthetic chat tests: customer-to-contractor and contractor-to-customer events were queued; private message text was not included.
- Atomic claim test: first claim succeeded, concurrent second claim returned no row.
- Database webhook to Edge Function: 8 requests returned HTTP 200; all 8 synthetic outbox events closed successfully, with 0 pending and 0 processing.
- No browser subscriptions were registered at the time of backend verification, so no external push notification was sent.

## Test on a real browser/device
Open `/staging-push-test/` on the feature-branch Preview deployment over HTTPS:
1. Create a separate test account in the staging project (do not use a Production account/password).
2. If email confirmation is enabled, confirm the email and return to the same Preview page to sign in.
3. Press **Enable push on this device** and allow browser notifications.
4. Press **Send a test notification**. The page should report one accepted device, and the browser should show a generic ZELPX staging notification.
5. Test on a second browser/device by signing in with the same staging test account and repeating steps 3–4.
6. Use **Remove this device subscription** to revoke a test endpoint.

The page is served by the feature-branch Vercel Preview, not the Production custom domain. The Preview deployment is protected by Vercel SSO. It does not change the Production domain or environment variables.

## Remaining integration work
The browser test verifies the VAPID pair, device registration and actual delivery. It does not yet connect the existing Production customer/contractor screens to the staging Auth project. To test real lead/chat workflows end-to-end, the staging frontend must be configured with staging credentials and a test contractor/customer fixture, then register the subscriptions in `contractor_push_subscriptions` and `chat_push_subscriptions`. Do not change the Production frontend's existing VAPID key or `send-chat-push` function as part of this staging task.

## Safety
No Production migrations, Production Edge Functions, Stripe settings, Vercel Production environment variables or Production deployments were changed. No merge to `main` was performed.
