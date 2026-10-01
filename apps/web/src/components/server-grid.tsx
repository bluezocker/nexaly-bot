import type { PublicServer } from "@/lib/public-servers";

export function ServerGrid({ servers }: { servers: PublicServer[] }) {
  if (servers.length === 0) {
    return <p className="text-sm text-nx-muted">Noch keine öffentlichen Server.</p>;
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {servers.map((server, index) => (
        <li key={`${server.name}-${index}`} className="flex items-center gap-3 rounded-2xl border border-nx-border bg-nx-card p-4">
          {server.iconUrl ? (
            <img src={server.iconUrl} alt="" width={48} height={48} className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-nx-elevated text-sm font-semibold text-nx-accent-soft">
              {server.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-medium">{server.name}</p>
            <p className="text-xs text-nx-muted">
              {server.memberCount != null ? `${server.memberCount.toLocaleString("de-DE")} Mitglieder` : "Mitglieder unbekannt"}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
