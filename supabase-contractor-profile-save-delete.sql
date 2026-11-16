-- ZELPX: safe deletion of reviewed change-request history.
-- Does not delete contractor accounts, profiles, leads, purchases, messages or documents.

create or replace function public.delete_own_reviewed_contractor_change_request(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare v_count integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from public.contractor_change_requests
   where id = p_request_id
     and user_id = auth.uid()
     and lower(coalesce(status,'')) <> 'pending';
  get diagnostics v_count = row_count;
  return v_count = 1;
end
$function$;

create or replace function public.admin_delete_contractor_change_request(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare v_count integer;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then raise exception 'Administrator access required'; end if;
  delete from public.contractor_change_requests
   where id = p_request_id
     and lower(coalesce(status,'')) <> 'pending';
  get diagnostics v_count = row_count;
  return v_count = 1;
end
$function$;

revoke all on function public.delete_own_reviewed_contractor_change_request(uuid) from public;
revoke all on function public.admin_delete_contractor_change_request(uuid) from public;
grant execute on function public.delete_own_reviewed_contractor_change_request(uuid) to authenticated;
grant execute on function public.admin_delete_contractor_change_request(uuid) to authenticated;
