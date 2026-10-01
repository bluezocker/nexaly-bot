import { LegalPage } from "@/components/site-footer";

export default function TermsPage() {
  return (
    <LegalPage title="Nutzungsbedingungen">
      <p>Mit der Nutzung von Nexaly akzeptierst du diese Bedingungen.</p>
      <section className="grid gap-2">
        <h2 className="text-base font-semibold text-white">Zulässige Nutzung</h2>
        <p>
          Nexaly dient der Verwaltung von Discord-Servern. Kein Einsatz gegen geltendes Recht oder
          die Discord Terms of Service.
        </p>
      </section>
      <section className="grid gap-2">
        <h2 className="text-base font-semibold text-white">Zugriff</h2>
        <p>
          Dashboard-Zugang hängt an Discord-OAuth und Server-Rechten (Owner, Administrator, Manage
          Server oder hinterlegte Manager-Rolle).
        </p>
      </section>
      <section className="grid gap-2">
        <h2 className="text-base font-semibold text-white">Inhalte</h2>
        <p>Für Willkommenstexte, Embeds und Auto-Mod-Regeln bist du verantwortlich.</p>
      </section>
    </LegalPage>
  );
}
