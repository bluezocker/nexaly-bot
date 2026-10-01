import { ApiBanner } from "@/lib/api-banner";
import { apiFetchSafe } from "@/lib/api";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

type Payload = {
  locale: string;
  timezone: string;
  managerRoleIds: string[];
  dataRetentionDays: number;
  deletedMessageLogDays: number;
  modules: { key: string; label: string; enabled: boolean }[];
  roles: { id: string; name: string; color: number; managed: boolean }[];
};

export default async function SettingsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const loaded = await apiFetchSafe<Payload>(`/v1/guilds/${guildId}/settings`, {
    locale: "de",
    timezone: "Europe/Berlin",
    managerRoleIds: [],
    dataRetentionDays: 90,
    deletedMessageLogDays: 30,
    modules: [],
    roles: [],
  });

  return (
    <div>
      <ApiBanner error={loaded.error} />
      <SettingsForm
        guildId={guildId}
        locale={loaded.data.locale}
        timezone={loaded.data.timezone}
        managerRoleIds={loaded.data.managerRoleIds}
        dataRetentionDays={loaded.data.dataRetentionDays}
        deletedMessageLogDays={loaded.data.deletedMessageLogDays}
        modules={loaded.data.modules}
        roles={loaded.data.roles}
      />
    </div>
  );
}
