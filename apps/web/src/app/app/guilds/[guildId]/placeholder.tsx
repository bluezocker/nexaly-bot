export function ModulePlaceholder({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-nx-border bg-nx-card p-8">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 max-w-lg text-sm text-nx-muted">
        Navigation steht. Die Modul-Logik kommt in Phase 3.
      </p>
    </div>
  );
}
