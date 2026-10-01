import { LegalPage } from "@/components/site-footer";

export default function AgbPage() {
  return (
    <LegalPage title="Allgemeine Geschäftsbedingungen">
      <p>Stand: September 2026. Gilt für die Nutzung von Nexaly über nexaly.app.</p>
      <section className="grid gap-2">
        <h2 className="text-base font-semibold text-white">1. Leistung</h2>
        <p>
          Nexaly stellt einen Discord-Bot und ein Web-Dashboard zur Verwaltung von Server-Modulen
          bereit.
        </p>
      </section>
      <section className="grid gap-2">
        <h2 className="text-base font-semibold text-white">2. Pflichten</h2>
        <p>
          Du darfst Nexaly nur auf Discord-Servern einsetzen, die du rechtmäßig verwaltest.
        </p>
      </section>
      <section className="grid gap-2">
        <h2 className="text-base font-semibold text-white">3. Verfügbarkeit</h2>
        <p>Kein Anspruch auf ununterbrochene Verfügbarkeit. Wartung kann den Dienst unterbrechen.</p>
      </section>
      <section className="grid gap-2">
        <h2 className="text-base font-semibold text-white">4. Haftung</h2>
        <p>
          Für leichte Fahrlässigkeit nur bei Verletzung wesentlicher Vertragspflichten, begrenzt auf
          den vorhersehbaren Schaden.
        </p>
      </section>
    </LegalPage>
  );
}
