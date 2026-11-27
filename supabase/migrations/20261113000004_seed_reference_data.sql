-- =============================================================================
-- Reference data
-- =============================================================================
-- * 12 motorcycle model categories CONFIRMED by the client.
-- * Part categories are SUGGESTIONS ONLY, awaiting the owner's confirmation.
--   They are harmless until products are assigned: the public website only
--   lists categories that contain at least one published product.
-- * Business settings contain ONLY confirmed information. Unconfirmed fields
--   (WhatsApp, hours, maps link, social links, history) are left NULL.
-- No products are seeded — the catalogue starts empty by design.
-- =============================================================================

insert into public.motorcycle_models (name, slug, sort_order) values
  ('Bullet',              'bullet',              10),
  ('Classic',             'classic',             20),
  ('Electra',             'electra',             30),
  ('Thunderbird',         'thunderbird',         40),
  ('Standard',            'standard',            50),
  ('Meteor 350',          'meteor-350',          60),
  ('Hunter 350',          'hunter-350',          70),
  ('Himalayan',           'himalayan',           80),
  ('Scram',               'scram',               90),
  ('Interceptor 650',     'interceptor-650',     100),
  ('Continental GT 650',  'continental-gt-650',  110),
  ('Other / Newer Models','other-newer-models',  120)
on conflict (slug) do nothing;

insert into public.product_categories (name, slug, sort_order) values
  ('Engine Parts',            'engine-parts',            10),
  ('Clutch and Transmission', 'clutch-and-transmission', 20),
  ('Braking System',          'braking-system',          30),
  ('Electrical Components',   'electrical-components',   40),
  ('Body Parts',              'body-parts',              50),
  ('Lighting and Indicators', 'lighting-and-indicators', 60),
  ('Suspension',              'suspension',              70),
  ('Accessories',             'accessories',             80),
  ('Other Parts',             'other-parts',             90)
on conflict (slug) do nothing;

insert into public.business_settings (id, business_name, address, landline)
values (
  1,
  'S Ameer Ali Bullet Spare Parts',
  'Old 25, Wheelers Market, Pudupet, Komaleeswaranpet, Egmore, Chennai, Tamil Nadu 600002',
  '044 2841 5241'
)
on conflict (id) do nothing;
