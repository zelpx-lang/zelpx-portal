-- DEPRECATED: Do not run this file.
-- Contractor change requests are now retained as permanent review evidence.
-- The profile approval migration revokes these delete paths and removes delete policies.
revoke all on function public.delete_own_reviewed_contractor_change_request(uuid) from public, anon, authenticated;
revoke all on function public.admin_delete_contractor_change_request(uuid) from public, anon, authenticated;
