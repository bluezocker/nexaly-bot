import Link from "next/link";
import { LegalPage } from "@/components/site-footer";

export default function PrivacyPage() {
  return (
    <LegalPage title="Datenschutzerklärung">
      <p>Welche Daten Nexaly verarbeitet, wenn du Dashboard oder Bot nutzt.</p>
      <section className="grid gap-2">
        <h2 className="text-base font-semibold text-white">Verantwortlicher</h2>
        <p>
          Angaben zum Anbieter stehen im{" "}
          <Link href="/impressum" className="text-nx-accent-soft hover:underline">
            Impressum
          </Link>
          .
        </p>
      </section>
      <section className="grid gap-2">
        <h2 className="text-base font-semibold text-white">Welche Daten</h2>
        <p>
          Discord-Nutzer-ID, Benutzername, Avatar, Server-Mitgliedschaft und Modul-Konfigurationen.
          Nachrichteninhalte nur, soweit ein Log-Event das vorsieht.
        </p>
      </section>
      <section className="grid gap-2">
        <h2 className="text-base font-semibold text-white">Zweck</h2>
        <p>
          Betrieb von Bot und Dashboard (Art. 6 Abs. 1 lit. b DSGVO) sowie Sicherheit (Art. 6 Abs. 1
          lit. f DSGVO).
        </p>
      </section>
      <section className="grid gap-2">
        <h2 className="text-base font-semibold text-white">Rechte</h2>
        <p>Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch.</p>
      </section>
    </LegalPage>
  );
}
