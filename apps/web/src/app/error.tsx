"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center">
      <p className="text-sm text-nx-accent-soft">Nexaly</p>
      <h1 className="mt-3 text-2xl font-semibold">Etwas ist schiefgelaufen</h1>
      <p className="mt-3 text-sm text-nx-muted">{error.message || "Serverfehler beim Laden der Seite."}</p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 rounded-lg bg-nx-accent px-4 py-2 text-sm font-medium text-white"
      >
        Erneut versuchen
      </button>
    </main>
  );
}
