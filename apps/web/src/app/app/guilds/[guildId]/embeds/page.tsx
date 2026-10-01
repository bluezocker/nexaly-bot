import { ApiBanner } from "@/lib/api-banner";
import { apiFetchSafe } from "@/lib/api";
import { EmbedBuilder } from "./embed-builder";

export const dynamic = "force-dynamic";

type Binding = { id: string; channelId: string; messageId: string; emoji: string; roleId: string };
type Role = { id: string; name: string };
type Payload = {
  templates: { id: string; name: string; content: string | null; embed: never }[];
  bindings?: Binding[];
};

export default async function EmbedsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const [data, channels, settings] = await Promise.all([
    apiFetchSafe<Payload>(`/v1/guilds/${guildId}/embeds`, { templates: [], bindings: [] }),
    apiFetchSafe<{ channels: { id: string; name: string }[] }>(`/v1/guilds/${guildId}/channels`, { channels: [] }),
    apiFetchSafe<{ roles: Role[] }>(`/v1/guilds/${guildId}/settings`, { roles: [] }),
  ]);

  return (
    <div>
      <ApiBanner error={data.error ?? channels.error} />
      <EmbedBuilder
        guildId={guildId}
        templates={(data.data.templates ?? []) as never}
        channels={channels.data.channels ?? []}
        roles={settings.data.roles ?? []}
        bindings={data.data.bindings ?? []}
      />
    </div>
  );
}
