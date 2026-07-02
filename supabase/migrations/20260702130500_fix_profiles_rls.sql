-- Fix recursive RLS on profiles admin policies

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and is_active = true
  );
$$;

drop policy if exists "Admins can view employee profiles" on public.profiles;
drop policy if exists "Admins can update employee profiles" on public.profiles;

create policy "Admins can view employee profiles"
  on public.profiles
  for select
  to authenticated
  using (public.is_admin() and account_type = 'employee');

create policy "Admins can update employee profiles"
  on public.profiles
  for update
  to authenticated
  using (public.is_admin() and account_type = 'employee')
  with check (account_type = 'employee');
