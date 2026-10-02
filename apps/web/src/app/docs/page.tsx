import Link from "next/link";
import type { ReactNode } from "react";
import { LegalPage } from "@/components/site-footer";

const sections = [
  ["start", "Start"],
  ["rechte", "Rechte"],
  ["dashboard", "Dashboard"],
  ["logs", "Logs"],
  ["moderation", "Moderation"],
  ["welcome", "Willkommen"],
  ["levels", "Level"],
  ["streams", "Live-Alerts"],
  ["embeds", "Embeds"],
  ["tickets", "Tickets"],
  ["social", "Social"],
  ["befehle", "Befehle"],
] as const;

export default function DocsPage() {
  return (
    <LegalPage title="Docs">
      <p>
        Anleitung für Server, die Nexaly nutzen. Es steht nur drin, was der Bot tatsächlich macht.
        Den Systemstatus gibt es unter{" "}
        <a href="https://status.nexaly.app/status/nexaly" className="text-nx-accent-soft hover:underline" rel="noopener noreferrer">
          status.nexaly.app
        </a>
        .
      </p>
      <nav className="flex flex-wrap gap-2">
        {sections.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="rounded-full border border-nx-border px-3 py-1 text-xs text-nx-muted hover:text-white">
            {label}
          </a>
        ))}
      </nav>

      <Section id="start" title="Start">
        <p>Nexaly auf den Server einladen, danach unter Dashboard mit Discord anmelden und den Server öffnen.</p>
        <p>
          Du siehst nur Server, auf denen du Eigentümer bist oder die Rechte Administrator bzw. Server verwalten hast.
          Jeder Server hat eigene Einstellungen.
        </p>
      </Section>

      <Section id="rechte" title="Rechte des Bots">
        <p>Die Bot-Rolle muss über den Rollen stehen, die er vergeben oder entziehen soll.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Nachrichten senden, Links einbetten, Dateien anhängen, Nachrichtenverlauf lesen, Reaktionen hinzufügen</li>
          <li>Nachrichten verwalten für Auto-Mod und /purge</li>
          <li>Mitglieder kicken, bannen und einen Timeout geben</li>
          <li>Rollen verwalten für Reaktionsrollen und Level-Belohnungen</li>
          <li>Kanäle verwalten für Tickets</li>
          <li>Audit-Log einsehen, damit Logs den Ausführer nennen können</li>
        </ul>
      </Section>

      <Section id="dashboard" title="Dashboard">
        <p>
          Nach der Anmeldung über{" "}
          <Link href="/login" className="text-nx-accent-soft hover:underline">
            Mit Discord anmelden
          </Link>{" "}
          wählst du einen Server. Module schaltest du auf der jeweiligen Seite oder unter Einstellungen ein.
          Ohne aktives Modul passiert auf dem Server nichts, auch wenn der Bot online ist.
        </p>
      </Section>

      <Section id="logs" title="Logs">
        <p>Pro Ereignis ein Kanal. Nexaly schreibt ein Embed, keinen Rohtext.</p>
        <p>
          Nachrichten gelöscht oder bearbeitet, Beitritt und Austritt, Nickname, Ban, Entbannung, Kick, Timeout,
          Rollen an Mitgliedern, Rolle oder Kanal erstellt, geändert oder gelöscht, Voice beigetreten, verlassen oder gewechselt.
        </p>
        <p>
          Ein Ausführer steht nur im Embed, wenn genau ein Audit-Log-Eintrag zu Ziel, Aktion und Zeitfenster passt.
          Sonst bleibt das Feld leer. Discord liefert den Ausführer nicht immer.
        </p>
      </Section>

      <Section id="moderation" title="Moderation">
        <p>
          Auto-Mod kann Spam, doppelte Nachrichten, zu viele Erwähnungen, zu viele Emojis, Caps, Links und Discord-Einladungen erkennen.
          Erlaubte und blockierte Domains lassen sich setzen. Raid-Schutz zählt Beitritte in einem Zeitfenster und kann warnen.
        </p>
        <p>
          Regeln gelten pro Server: Wort, Einladung, Domain oder eigenes Muster, mit Aktion Löschen, Verwarnen, Timeout, Kick oder Ban.
          Rollen und Kanäle können ausgenommen werden. Mitglieder mit Nachrichten verwalten oder Administrator prüft der Auto-Mod nicht.
          Den Server-Eigentümer und sich selbst moderiert Nexaly nicht.
        </p>
      </Section>

      <Section id="welcome" title="Willkommen">
        <p>Beim Beitritt eine Nachricht im Kanal, optional zusätzlich als Direktnachricht. Drei Modi: Text, Embed oder Bildkarte.</p>
        <p>
          Platzhalter: {"{user}"}, {"{user.name}"}, {"{server}"}, {"{memberCount}"}. Die Bildkarte nimmt ein eigenes Hintergrundbild bis 2 MB, PNG, JPEG oder WebP.
        </p>
      </Section>

      <Section id="levels" title="Level">
        <p>
          XP gibt es pro Nachricht, mit Cooldown. Die Kurve bis zum nächsten Level ist 5n² + 50n + 100.
          Rollenbelohnungen hängen an einem Level. Die Rolle muss unter der Bot-Rolle liegen.
        </p>
        <p>/rank zeigt das eigene oder ein anderes Level. /leaderboard die Rangliste des Servers.</p>
      </Section>

      <Section id="streams" title="Live-Alerts">
        <p>
          Twitch, YouTube und Kick. Nexaly prüft die Kanäle über die offiziellen Schnittstellen und postet, wenn ein Stream live geht.
          Ohne die API-Keys auf dem Nexaly-Server gibt es keinen Live-Status. Keys trägst du nicht im Dashboard ein.
        </p>
        <p>
          Beim Anlegen kannst du eine Rolle erwähnen oder keine. @everyone steht nur hier zur Auswahl, nicht bei Reaktionsrollen, Tickets oder Level-Belohnungen, weil Nexaly diese Rolle dort nicht vergeben darf.
        </p>
        <p>
          Eine normale Rolle muss in Discord als erwähnbar gesetzt sein. Für @everyone braucht der Bot die Berechtigung „Erwähne @everyone, @here und Alle Rollen“.
          Steht die Erwähnung bei einem schon gespeicherten Alert noch nicht, den Alert entfernen und neu anlegen.
        </p>
      </Section>

      <Section id="embeds" title="Embeds und Reaktionsrollen">
        <p>
          Vorlagen speichern und in einen Textkanal senden. Dafür braucht der Bot im Kanal Kanal ansehen, Nachrichten senden und Links einbetten.
          An dieselbe Nachricht können bis zu 20 Reaktionen, jede mit einer eigenen Rolle.
          Klick vergibt die Rolle, Entfernen nimmt sie wieder weg. Der Bot setzt die Reaktionen nacheinander.
        </p>
        <p>
          Eine schon vorhandene Nachricht geht über den Nachrichten-Link unter „Vorhandene Nachricht“. Der Bot setzt die Reaktion selbst.
          Emojis gehen als Zeichen oder Kurzname, zum Beispiel :blue_heart:. Server-Emojis im Format name:id.
          @everyone, verwaltete Rollen und Administrator-Rollen sind gesperrt. Die Rolle muss unter der Bot-Rolle liegen.
        </p>
      </Section>

      <Section id="tickets" title="Tickets">
        <p>
          Kanal, Kategorie und Team-Rolle setzen, speichern, dann Panel senden. Der Button öffnet einen privaten Kanal für den Nutzer und die Team-Rolle.
          Pro Person nur ein offenes Ticket.
        </p>
        <p>
          Schließen sperrt das Schreiben und benennt den Kanal um. Löschen darf nur das Team oder jemand mit Kanäle verwalten.
          Dafür braucht der Bot die Berechtigung Kanäle verwalten.
        </p>
        <p>
          Ist ein Log-Kanal gesetzt, speichert Nexaly beim Schließen ein Protokoll dort: eine HTML-Datei mit dem ganzen Verlauf, die du herunterlädst und im Browser öffnest.
          Bilder bis 2 MB sind eingebettet, andere Anhänge stehen nur mit Namen drin.
          Wird nach dem Schließen noch geschrieben, kommt beim Löschen ein aktualisiertes Protokoll.
          Kann das Protokoll nicht gespeichert werden, löscht der Bot den Kanal nicht. Im Log-Kanal braucht er Nachrichten senden, Links einbetten und Dateien anhängen.
        </p>
      </Section>

      <Section id="social" title="Social">
        <p>
          Neue Posts von X und Threads landen in einem Kanal. Antworten und Reposts nicht. Bestehende Posts werden beim Hinzufügen nicht nachgeholt. Die Prüfung läuft etwa alle fünf Minuten.
        </p>
        <p>
          X: öffentlicher Benutzername über die X API v2. Dafür braucht der Server ein Bearer-Token mit Lesezugriff auf User-Timelines.
          Threads: nur das Konto, das sich im Dashboard anmeldet. Meta gibt fremde Profile im Standardzugang nicht frei, deshalb gibt es keine Namenssuche.
        </p>
      </Section>

      <Section id="befehle" title="Befehle">
        <ul className="list-disc space-y-1 pl-5">
          <li>/ping und /help</li>
          <li>/rank und /leaderboard</li>
          <li>/warn, /warnings, /timeout, /untimeout, /kick, /ban, /unban</li>
          <li>/purge, /slowmode, /userinfo, /serverinfo</li>
        </ul>
        <p>Einstellungen laufen über das Dashboard, nicht über Slash-Befehle.</p>
      </Section>
    </LegalPage>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="grid scroll-mt-6 gap-2">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}
