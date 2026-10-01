import { ApiBanner } from "@/lib/api-banner";
import { apiFetchSafe } from "@/lib/api";
import { ModerationForm } from "./moderation-form";

export const dynamic = "force-dynamic";

type Payload = {
  enabled: boolean;
  settings: Record<string, unknown> | null;
  rules: { id: string; pattern: string; matchMode: string; action: string; type: string }[];
  ladder: { step: number; action: string; durationSec: number | null }[];
};

type CasesPayload = {
  cases: { caseNumber: number; action: string; targetId: string; reason: string | null }[];
};

export default async function ModerationPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  const [moderation, cases] = await Promise.all([
    apiFetchSafe<Payload>(`/v1/guilds/${guildId}/moderation`, {
      enabled: false,
      settings: null,
      rules: [],
      ladder: [],
    }),
    apiFetchSafe<CasesPayload>(`/v1/guilds/${guildId}/moderation/cases`, { cases: [] }),
  ]);

  return (
    <div>
      <ApiBanner error={moderation.error ?? cases.error} />
      <ModerationForm
        guildId={guildId}
        enabled={moderation.data.enabled}
        settings={moderation.data.settings as never}
        rules={moderation.data.rules ?? []}
        ladder={moderation.data.ladder ?? []}
        cases={cases.data.cases ?? []}
      />
    </div>
  );
}
