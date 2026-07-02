drop policy if exists "Users can update own pending or admins update any" on public.price_list_items;

create policy "Price list update access"
  on public.price_list_items for update to authenticated
  using (
    public.user_has_module('price-list')
    and (
      public.is_admin()
      or (created_by = auth.uid() and status = 'pending_approval')
      or (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'accountant' and p.is_active = true
        )
        and status = 'approved'
      )
    )
  )
  with check (public.user_has_module('price-list'));
