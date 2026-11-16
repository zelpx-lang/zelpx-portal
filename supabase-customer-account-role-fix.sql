-- ZELPX: respect customer vs contractor account type on signup.
-- New customers are currently inserted into profiles with role='contractor'
-- because handle_new_user() ignores auth user metadata.
-- This affects only future signups; it does not rewrite existing profile roles.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text;
begin
  v_role := case
    when new.raw_user_meta_data ->> 'account_type' = 'customer' then 'customer'
    else 'contractor'
  end;

  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    v_role
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;
