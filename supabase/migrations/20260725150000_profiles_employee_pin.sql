-- Store recoverable employee PIN for admin visibility.
-- Auth password remains the hashed login credential in auth.users.

alter table public.profiles
  add column if not exists pin text;

alter table public.profiles
  drop constraint if exists profiles_pin_format_check;

alter table public.profiles
  add constraint profiles_pin_format_check
  check (
    pin is null
    or pin ~ '^\d{4,6}$'
  );

comment on column public.profiles.pin is
  'Plaintext employee PIN for admin display; kept in sync with auth password on create/reset.';
