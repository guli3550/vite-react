-- GULI: reconcile canonical customers during order writes.
-- Fixes the production race where auth_user_id and telegram_id exist on
-- different customer rows and the order trigger violates customers_telegram_id_uidx.

DO $$
DECLARE
  auth_customer uuid;
  tg_customer uuid;
  tg_id bigint := 5061637303;
  auth_id uuid := 'd8034f73-303f-4b08-8bdf-4f422b8e8576';
BEGIN
  SELECT id INTO auth_customer FROM public.customers WHERE auth_user_id=auth_id LIMIT 1;
  SELECT id INTO tg_customer FROM public.customers WHERE telegram_id=tg_id LIMIT 1;

  IF auth_customer IS NOT NULL AND tg_customer IS NOT NULL AND auth_customer <> tg_customer THEN
    DELETE FROM public.customers WHERE id=tg_customer;
    UPDATE public.customers
      SET telegram_id=tg_id, updated_at=now()
      WHERE id=auth_customer;
  ELSIF auth_customer IS NULL AND tg_customer IS NOT NULL THEN
    UPDATE public.customers
      SET auth_user_id=auth_id, updated_at=now()
      WHERE id=tg_customer;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.guli_link_order_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  by_auth public.customers%rowtype;
  by_tg public.customers%rowtype;
  by_phone public.customers%rowtype;
  c_id uuid;
  p text;
BEGIN
  p := regexp_replace(coalesce(new.phone,''),'[^0-9]','','g');

  IF new.auth_user_id IS NOT NULL THEN
    SELECT * INTO by_auth FROM public.customers
    WHERE auth_user_id=new.auth_user_id LIMIT 1;
  END IF;

  IF new.telegram_id IS NOT NULL THEN
    SELECT * INTO by_tg FROM public.customers
    WHERE telegram_id=new.telegram_id LIMIT 1;
  END IF;

  IF by_auth.id IS NOT NULL AND by_tg.id IS NOT NULL AND by_auth.id<>by_tg.id THEN
    IF by_tg.auth_user_id IS NOT NULL
       AND by_tg.auth_user_id IS DISTINCT FROM new.auth_user_id THEN
      RAISE EXCEPTION 'Mijoz identifikatsiyalari mos emas';
    END IF;

    DELETE FROM public.customers WHERE id=by_tg.id;

    UPDATE public.customers
      SET telegram_id=coalesce(by_tg.telegram_id,new.telegram_id),
          phone=coalesce(by_auth.phone,by_tg.phone,new.phone),
          full_name=coalesce(by_auth.full_name,by_tg.full_name),
          avatar_url=coalesce(by_auth.avatar_url,by_tg.avatar_url),
          auth_provider=coalesce(by_auth.auth_provider,by_tg.auth_provider),
          updated_at=now()
      WHERE id=by_auth.id;

    c_id := by_auth.id;

  ELSIF by_auth.id IS NOT NULL THEN
    c_id := by_auth.id;

  ELSIF by_tg.id IS NOT NULL THEN
    IF by_tg.auth_user_id IS NOT NULL
       AND new.auth_user_id IS NOT NULL
       AND by_tg.auth_user_id IS DISTINCT FROM new.auth_user_id THEN
      RAISE EXCEPTION 'Mijoz identifikatsiyalari mos emas';
    END IF;

    UPDATE public.customers
      SET auth_user_id=coalesce(auth_user_id,new.auth_user_id),
          phone=coalesce(phone,new.phone),
          updated_at=now()
      WHERE id=by_tg.id;

    c_id := by_tg.id;

  ELSIF length(p)>=7 THEN
    SELECT * INTO by_phone FROM public.customers
    WHERE regexp_replace(coalesce(phone,''),'[^0-9]','','g')=p
    ORDER BY updated_at DESC NULLS LAST LIMIT 1;

    IF by_phone.id IS NOT NULL THEN c_id := by_phone.id; END IF;
  END IF;

  IF c_id IS NOT NULL THEN
    SELECT * INTO by_auth FROM public.customers WHERE id=c_id LIMIT 1;

    IF new.auth_user_id IS NULL AND by_auth.auth_user_id IS NOT NULL THEN
      new.auth_user_id := by_auth.auth_user_id;
    END IF;

    IF new.telegram_id IS NULL AND by_auth.telegram_id IS NOT NULL THEN
      new.telegram_id := by_auth.telegram_id;
    END IF;

    UPDATE public.customers
      SET auth_user_id=coalesce(auth_user_id,new.auth_user_id),
          telegram_id=coalesce(telegram_id,new.telegram_id),
          phone=coalesce(phone,new.phone),
          updated_at=now()
      WHERE id=c_id;
  END IF;

  RETURN new;
END;
$function$;
