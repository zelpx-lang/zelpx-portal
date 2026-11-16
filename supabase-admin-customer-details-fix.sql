-- ZELPX: allow verified admins to read customer name and phone for request review.
-- Additive migration only: does not alter or delete existing profiles or requests.
create or replace function public.admin_get_customer_profiles(p_user_ids uuid[])
returns table(user_id uuid, full_name text, phone text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  return query
    select p.id, p.full_name, p.phone
    from public.profiles p
    where p.id = any(coalesce(p_user_ids, array[]::uuid[]));
end;
$$;

revoke all on function public.admin_get_customer_profiles(uuid[]) from public;
grant execute on function public.admin_get_customer_profiles(uuid[]) to authenticated;
notify pgrst, 'reload schema';
