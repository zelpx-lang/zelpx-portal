-- Do not mark a company license verified merely because an admin approves a profile update.
-- The admin must verify the license number separately in the contractor review panel.
do $migration$
declare
  v_definition text;
  v_old text := 'license_review_status=case when v_license_route then ''verified'' else ''not_applicable'' end,';
  v_new text := 'license_review_status=case when v_license_route then ''pending'' else ''not_applicable'' end,';
begin
  v_definition := pg_get_functiondef('public.review_contractor_change_request(uuid,text,text)'::regprocedure);
  if position(v_old in v_definition) = 0 then
    raise exception 'Expected company license review assignment was not found; migration stopped';
  end if;
  v_definition := regexp_replace(v_definition, v_old, v_new);
  execute v_definition;
end;
$migration$;
