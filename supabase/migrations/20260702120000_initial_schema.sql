-- Pilot Thread Mills — initial schema (v1)
-- Employees: phone + PIN (no OTP/SMS cost)
-- Customers (future): auth_method = otp_whatsapp

create type public.account_type as enum ('employee', 'customer');
create type public.auth_method as enum ('pin', 'otp_whatsapp');
create type public.employee_role as enum ('admin', 'manager', 'operator');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text not null unique,
  full_name text not null,
  account_type public.account_type not null default 'employee',
  auth_method public.auth_method not null default 'pin',
  role public.employee_role,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_employee_role_check check (
    (account_type = 'employee' and role is not null)
    or (account_type = 'customer' and role is null)
  ),
  constraint profiles_auth_method_check check (
    (account_type = 'employee' and auth_method = 'pin')
    or (account_type = 'customer')
  )
);

create index profiles_account_type_idx on public.profiles (account_type);
create index profiles_phone_idx on public.profiles (phone);

alter table public.profiles enable row level security;

-- Users can read their own profile
create policy "Users can view own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- Admins can view all employee profiles
create policy "Admins can view employee profiles"
  on public.profiles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.role = 'admin'
        and admin_profile.is_active = true
    )
    and account_type = 'employee'
  );

-- Admins can update employee profiles (deactivate, rename, etc.)
create policy "Admins can update employee profiles"
  on public.profiles
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.role = 'admin'
        and admin_profile.is_active = true
    )
    and account_type = 'employee'
  )
  with check (account_type = 'employee');

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.handle_updated_at();

-- Auto-create profile row when auth user is created (safety net for service-role inserts)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, phone, full_name, account_type, auth_method, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', 'Unknown'),
    coalesce((new.raw_user_meta_data ->> 'account_type')::public.account_type, 'employee'),
    coalesce((new.raw_user_meta_data ->> 'auth_method')::public.auth_method, 'pin'),
    (new.raw_user_meta_data ->> 'role')::public.employee_role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

comment on table public.profiles is
  'Unified identity for employees (PIN) and future customers (WhatsApp OTP).';
