-- Accountant price edits set status to pending_approval. UPDATE ... RETURNING
-- also enforces SELECT policies on the new row, so accountants must be able to
-- read pending items or the update is rejected with an RLS error.

drop policy if exists "Users with price-list access can view approved items"
  on public.price_list_items;

create policy "Users with price-list access can view items"
  on public.price_list_items for select to authenticated
  using (
    public.user_has_module('price-list')
    and (
      status = 'approved'
      or public.is_admin()
      or created_by = auth.uid()
      or (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role = 'accountant'
            and p.is_active = true
        )
        and status = 'pending_approval'
      )
    )
  );

-- Allow accountants to re-edit items already waiting for approval.
drop policy if exists "Price list update access" on public.price_list_items;

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
          where p.id = auth.uid()
            and p.role = 'accountant'
            and p.is_active = true
        )
        and status in ('approved', 'pending_approval')
      )
    )
  )
  with check (public.user_has_module('price-list'));
