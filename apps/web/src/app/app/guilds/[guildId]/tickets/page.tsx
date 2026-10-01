import { ApiBanner } from "@/lib/api-banner";
import { apiFetchSafe } from "@/lib/api";
import { TicketsForm } from "./tickets-form";

export const dynamic = "force-dynamic";

const fallbackSettings = {
  enabled: false,
  panelChannelId: null,
  categoryId: null,
  staffRoleId: null,
  logChannelId: null,
  panelTitle: "Support",
  panelText: "Klicke auf den Button, um ein Ticket zu öffnen.",
  openMessage: "Beschreibe dein Anliegen. Ein Teammitglied meldet sich.",
};

export default async function TicketsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const [tickets, channels, settings] = await Promise.all([
    apiFetchSafe<{ settings: typeof fallbackSettings; tickets: { id: string; number: number; channelId: string; status: string; createdAt: string }[] }>(
      `/v1/guilds/${guildId}/tickets`,
      { settings: fallbackSettings, tickets: [] },
    ),
    apiFetchSafe<{ channels: { id: string; name: string }[]; categories?: { id: string; name: string }[] }>(
      `/v1/guilds/${guildId}/channels`,
      { channels: [], categories: [] },
    ),
    apiFetchSafe<{ roles: { id: string; name: string }[] }>(`/v1/guilds/${guildId}/settings`, { roles: [] }),
  ]);

  return (
    <div>
      <ApiBanner error={tickets.error ?? channels.error} />
      <TicketsForm
        guildId={guildId}
        settings={tickets.data.settings ?? fallbackSettings}
        tickets={tickets.data.tickets ?? []}
        channels={channels.data.channels ?? []}
        categories={channels.data.categories ?? []}
        roles={settings.data.roles ?? []}
      />
    </div>
  );
}
