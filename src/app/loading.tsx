export default function Loading() {
  return (
    <div className="min-h-dvh grid place-items-center px-6">
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-10 w-10 rounded-full border-2 border-white/20 border-t-yellow-500 animate-spin"
          aria-label="Loading"
        />
        <div className="text-sm text-white/70">Loading…</div>
      </div>
    </div>
  );
}
