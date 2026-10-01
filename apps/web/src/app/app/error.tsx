"use client";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold">Modul konnte nicht geladen werden</h1>
      <p className="mt-2 text-sm text-nx-muted">{error.message}</p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-4 rounded-lg border border-nx-border px-4 py-2 text-sm"
      >
        Erneut versuchen
      </button>
    </div>
  );
}
