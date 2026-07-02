export default function OfflinePage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold text-slate-900">You are offline</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-600">
        Pilot Thread Mills needs a connection for most features. Reconnect and
        try again.
      </p>
      <a
        href="/dashboard"
        className="mt-6 rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white"
      >
        Retry
      </a>
    </div>
  );
}
