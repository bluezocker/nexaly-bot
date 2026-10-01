import { DISCORD_API_BASE } from "@nexaly/shared";

export async function sendWelcomeImage(input: {
  token: string;
  channelId: string;
  caption: string;
  png: Buffer;
}): Promise<void> {
  const form = new FormData();
  form.set("payload_json", JSON.stringify({ content: input.caption.slice(0, 1800) }));
  form.set("files[0]", new Blob([input.png], { type: "image/png" }), "welcome.png");
  const response = await fetch(`${DISCORD_API_BASE}/channels/${input.channelId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${input.token}` },
    body: form,
  });
  if (!response.ok) {
    throw new Error(`Discord welcome send failed: ${response.status} ${await response.text()}`);
  }
}
