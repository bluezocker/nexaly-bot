import { ApiBanner } from "@/lib/api-banner";
import { apiFetchSafe } from "@/lib/api";
import { WelcomeForm } from "./welcome-form";

export const dynamic = "force-dynamic";

type WelcomePayload = {
  enabled: boolean;
  settings: Record<string, unknown> | null;
};

type ChannelsPayload = { channels: { id: string; name: string }[] };

export default async function WelcomePage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  const [data, channels] = await Promise.all([
    apiFetchSafe<WelcomePayload>(`/v1/guilds/${guildId}/welcome`, { enabled: false, settings: null }),
    apiFetchSafe<ChannelsPayload>(`/v1/guilds/${guildId}/channels`, { channels: [] }),
  ]);

  return (
    <div>
      <ApiBanner error={data.error ?? channels.error} />
      <WelcomeForm
        guildId={guildId}
        enabled={data.data.enabled}
        settings={data.data.settings as never}
        channels={channels.data.channels ?? []}
      />
    </div>
  );
}
