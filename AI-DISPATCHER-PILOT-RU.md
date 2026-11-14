# ZELPX AI Dispatcher pilot

This branch contains an isolated UI prototype at `/ai-dispatcher.html`.

## Safety boundary
- Prototype only. It does not write to Supabase.
- It does not read production customer or contractor data.
- It does not send email, SMS, push notifications, or chat messages.
- It does not place or record phone calls.
- It does not create appointments or leads.
- It does not change existing customer/contractor portals, Stripe, or lead purchase logic.

## Next implementation gates
1. Review the prototype in a branch preview.
2. Agree the exact data model and ownership/RLS rules before adding database tables.
3. Add authenticated Edge Functions for request intake and CRM operations.
4. Connect an AI provider only through server-side secrets; never put provider keys in browser code.
5. Select and configure a phone provider before enabling voice calls.
6. Test with synthetic data and explicit consent before production rollout.
