export default function AppLoading() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="flex items-center gap-3 text-sm text-muted">
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-border border-t-foreground"
          aria-hidden
        />
        Loading…
      </div>
    </div>
  );
}
