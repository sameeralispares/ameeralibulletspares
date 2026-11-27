-- ---------------------------------------------------------------------------
-- Shop address (owner-confirmed 18 Nov 2026). The earlier seed used the old
-- Wheelers Market address; this updates the single settings row.
-- ---------------------------------------------------------------------------
update public.business_settings
set address = '25, Venkatachalan Naicken Street, Pudupet, Chennai-02'
where id = 1;
