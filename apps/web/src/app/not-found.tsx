import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">Nicht gefunden</h1>
      <p className="mt-2 text-sm text-nx-muted">
        Die Seite existiert nicht oder du darfst diesen Server nicht verwalten.
      </p>
      <Link href="/app" className="mt-6 text-sm text-nx-accent-soft">
        Zurück zur Serverliste
      </Link>
    </main>
  );
}
