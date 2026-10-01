import { LegalPage } from "@/components/site-footer";

export default function ImpressumPage() {
  return (
    <LegalPage title="Impressum">
      <p>Angaben gemäß § 5 DDG (früher TMG).</p>
      <section className="grid gap-2">
        <h2 className="text-base font-semibold text-white">Anbieter</h2>
        <p>
          Nexaly
          <br />
          Web: nexaly.app
        </p>
        <p>
          Name, Anschrift und Kontakt des Betreibers hier ergänzen, bevor der Dienst produktiv
          läuft. Ohne diese Angaben ist das Impressum nicht vollständig.
        </p>
      </section>
      <section className="grid gap-2">
        <h2 className="text-base font-semibold text-white">Kontakt</h2>
        <p>contact@nexaly.app</p>
      </section>
    </LegalPage>
  );
}
