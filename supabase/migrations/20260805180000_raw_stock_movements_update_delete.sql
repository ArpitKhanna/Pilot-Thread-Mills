-- Allow correcting raw stock ledger entries (admin/accountant via module check).

create policy "Users with raw-stock-status can update movements"
  on public.raw_stock_movements for update to authenticated
  using (public.user_has_module('raw-stock-status'))
  with check (public.user_has_module('raw-stock-status'));

create policy "Users with raw-stock-status can delete movements"
  on public.raw_stock_movements for delete to authenticated
  using (public.user_has_module('raw-stock-status'));
