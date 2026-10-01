import Link from "next/link";
import { LegalPage } from "@/components/site-footer";

const topics = [
  ["#start", "Bot einladen und anmelden"],
  ["#rechte", "Welche Rechte der Bot braucht"],
  ["#logs", "Logs"],
  ["#moderation", "Moderation"],
  ["#welcome", "Willkommen"],
  ["#levels", "Level"],
  ["#streams", "Live-Alerts"],
  ["#embeds", "Embeds und Reaktionsrollen"],
  ["#tickets", "Tickets"],
  ["#social", "Social"],
  ["#befehle", "Slash-Befehle"],
];

export default function HilfePage() {
  return (
    <LegalPage title="Hilfe">
      <p>
        Nexaly ist ein Discord-Bot mit Web-Dashboard. Jeder Server verwaltet seine Module getrennt.
        Die Anleitung steht in den Docs.
      </p>
      <ul className="grid gap-2">
        {topics.map(([href, label]) => (
          <li key={href}>
            <Link href={`/docs${href}`} className="text-nx-accent-soft hover:underline">
              {label}
            </Link>
          </li>
        ))}
      </ul>
      <p>
        Anmeldung:{" "}
        <Link href="/login" className="text-nx-accent-soft hover:underline">
          Mit Discord anmelden
        </Link>
        . Status:{" "}
        <a href="https://status.nexaly.app/status/nexaly" className="text-nx-accent-soft hover:underline" rel="noopener noreferrer">
          status.nexaly.app
        </a>
        .
      </p>
    </LegalPage>
  );
}
