import { ApiBanner } from "@/lib/api-banner";
import { apiFetchSafe } from "@/lib/api";
import { SocialForm } from "./social-form";

export const dynamic = "force-dynamic";

type Sub = {
  id: string;
  platform: string;
  accountKey: string;
  displayName: string;
  announceChannelId: string;
  enabled: boolean;
  lastError: string | null;
  connected: boolean;
};

export default async function SocialPage({
  params,
  searchParams,
}: {
  params: Promise<{ guildId: string }>;
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const { guildId } = await params;
  const query = await searchParams;
  const [social, channels] = await Promise.all([
    apiFetchSafe<{ subscriptions: Sub[]; providers: { X: boolean; THREADS: boolean } }>(
      `/v1/guilds/${guildId}/social`,
      { subscriptions: [], providers: { X: false, THREADS: false } },
    ),
    apiFetchSafe<{ channels: { id: string; name: string }[] }>(`/v1/guilds/${guildId}/channels`, { channels: [] }),
  ]);
  const notice = query.connected ? "Threads verbunden." : query.error ? "Threads-Anmeldung fehlgeschlagen." : null;

  return (
    <div>
      <ApiBanner error={social.error ?? channels.error} />
      <SocialForm
        guildId={guildId}
        subscriptions={social.data.subscriptions ?? []}
        providers={social.data.providers ?? { X: false, THREADS: false }}
        channels={channels.data.channels ?? []}
        notice={notice}
      />
    </div>
  );
}
