# ZELPX portal update — staged files

## Included
- `index.html`: contractor portal. Authenticated Admin users are redirected to `/admin.html`; Contractor UI remains separate.
- `admin.html`: separate administrator portal, retaining the existing admin lead/request workflows and adding a read-only view of all conversations.
- `chat-access-policies.sql`: additive RLS policies for Customer read/send and Admin read-only access. Existing Contractor policies are not dropped or modified.
- `customer.html`, `customer-chat.html`, `vercel.json`: preserved from the supplied ZIP.

## Important deployment sequence
1. Back up the current GitHub/Vercel deployment.
2. Review and run `chat-access-policies.sql` in Supabase SQL Editor. This script is additive; it does not alter Stripe or purchase functions.
3. Deploy the files to the existing Vercel project. `admin.html` will be available at `/admin.html`.
4. Test with separate Customer, Contractor, and Admin accounts before production use.

## Current scope and known limitation
The Admin page adds a read-only conversation overview. The existing Customer email-token chat remains unchanged. The Customer Dashboard has not yet been modified to embed that chat; it continues to use the existing private `/customer-chat?token=...` link. The Admin chat list requires the additive policies in `chat-access-policies.sql`.

Do not deploy until the SQL has been reviewed against the live schema and tested in a safe environment.
