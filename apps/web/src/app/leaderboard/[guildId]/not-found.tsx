import Link from "next/link";

export default function LeaderboardNotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">Rangliste nicht gefunden</h1>
      <p className="mt-2 text-sm text-nx-muted">
        Diesen Server gibt es bei Nexaly nicht, oder er hat seine Rangliste nicht öffentlich gemacht.
      </p>
      <Link href="/" className="mt-6 text-sm text-nx-accent-soft">
        Zur Startseite
      </Link>
    </main>
  );
}
