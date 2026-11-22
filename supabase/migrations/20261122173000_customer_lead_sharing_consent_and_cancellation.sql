-- Record explicit customer consent for the lead marketplace model and allow
-- customers to withdraw an unpurchased request (including an available lead).
alter table public.service_requests
  add column if not exists commercial_sharing_consent_at timestamptz,
  add column if not exists commercial_sharing_consent_version text;

create or replace function public.cancel_own_service_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.service_requests%rowtype;
  v_lead_status text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  select *
    into v_request
  from public.service_requests
  where id = p_request_id
    and user_id = auth.uid()
    and hidden_at is null
  for update;

  if not found then
    raise exception 'Service request not found.';
  end if;

  if v_request.purchased_by is not null or v_request.status = 'sold' then
    raise exception 'This request has already been purchased and can no longer be cancelled.';
  end if;

  if v_request.lead_id is not null then
    select status into v_lead_status
    from public.leads
    where id = v_request.lead_id
    for update;

    if not found then
      raise exception 'The published lead could not be found. Please contact support.';
    end if;

    if v_lead_status <> 'available'
       or exists (select 1 from public.lead_purchases where lead_id = v_request.lead_id) then
      raise exception 'This request has already been purchased and can no longer be cancelled.';
    end if;

    update public.leads
      set status = 'expired'
    where id = v_request.lead_id
      and status = 'available';

    if not found then
      raise exception 'This lead is no longer available to cancel.';
    end if;
  elsif v_request.status <> 'new' then
    raise exception 'This request can no longer be cancelled online. Please contact ZELPX support.';
  end if;

  update public.service_requests
    set status = 'cancelled'
  where id = p_request_id
    and user_id = auth.uid()
    and purchased_by is null;

  if not found then
    raise exception 'This request could not be cancelled.';
  end if;

  return jsonb_build_object('success', true, 'status', 'cancelled');
end;
$$;

revoke all on function public.cancel_own_service_request(uuid) from public, anon;
grant execute on function public.cancel_own_service_request(uuid) to authenticated;
