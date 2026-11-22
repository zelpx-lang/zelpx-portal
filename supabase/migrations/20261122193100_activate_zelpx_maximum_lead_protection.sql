-- ZELPX Maximum Lead Protection activation.
-- Apply only after the updated customer portal is deployed.
-- Any pre-deployment request without a server-recorded confirmation is grandfathered.
update public.service_requests
set protection_required=false
where customer_live_confirmed_at is null;

create or replace function private.force_service_request_protection_fields()
returns trigger language plpgsql security definer set search_path='pg_catalog','public','auth','private'
as $function$
begin
 if tg_op='INSERT' then
  new.protection_required:=true;
  new.customer_live_confirmed_at:=null;
  new.customer_live_confirmation_version:=null;
 elsif new.protection_required is distinct from old.protection_required
   and new.protection_required=false
   and not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin') then
  raise exception 'Only an administrator can change lead protection enforcement.';
 end if;
 return new;
end;
$function$;

drop trigger if exists service_request_force_protection_fields on public.service_requests;
create trigger service_request_force_protection_fields
before insert or update of protection_required on public.service_requests
for each row execute function private.force_service_request_protection_fields();

create or replace function private.enforce_service_request_protection()
returns trigger language plpgsql security definer set search_path='pg_catalog','public','auth','private'
as $function$
declare v_email_confirmed boolean; v_risk_level text; v_checks jsonb;
begin
 if new.lead_id is null or new.status<>'published' or not coalesce(new.protection_required,true) then return new; end if;
 if new.customer_live_confirmed_at is null or coalesce(trim(new.customer_live_confirmation_version),'')=''
    or new.commercial_sharing_consent_at is null or coalesce(trim(new.commercial_sharing_consent_version),'')='' then
  raise exception 'Customer confirmation is required before this request can be published.';
 end if;
 select (u.email_confirmed_at is not null) into v_email_confirmed from auth.users u where u.id=new.user_id;
 if not coalesce(v_email_confirmed,false) then raise exception 'Customer email must be verified before this request can be published.'; end if;
 select risk_level,checks into v_risk_level,v_checks from public.lead_verification_checks where request_id=new.id;
 if not found then raise exception 'Automatic lead verification has not completed. Please retry review.'; end if;
 if v_risk_level='high'
    or coalesce((v_checks->>'same_customer_duplicate')::boolean,false)
    or coalesce((v_checks->>'duplicate_description')::boolean,false)
    or not coalesce((v_checks->>'zip_format_valid')::boolean,false) then
  raise exception 'ZELPX protection review blocked this lead. Resolve the verification flags before publishing.';
 end if;
 return new;
end;
$function$;

drop trigger if exists service_request_protection_before_publish on public.service_requests;
create trigger service_request_protection_before_publish before update of lead_id,status on public.service_requests
for each row execute function private.enforce_service_request_protection();
