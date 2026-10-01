import { readFile } from "node:fs/promises";
import type { WelcomeCardJob } from "@nexaly/shared";
import { parseHex, solidPng } from "./png.js";

const WIDTH = 1024;
const HEIGHT = 450;

export async function renderWelcomeCard(job: WelcomeCardJob): Promise<Buffer> {
  try {
    return await renderWithCanvas(job);
  } catch {
    return solidPng(WIDTH, HEIGHT, parseHex(job.accentColor || "#7C5CFF"));
  }
}

async function renderWithCanvas(job: WelcomeCardJob): Promise<Buffer> {
  const canvasMod = await import("@napi-rs/canvas");
  const { createCanvas, loadImage } = canvasMod;
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = job.accentColor.startsWith("#") ? job.accentColor : `#${job.accentColor}`;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  if (job.backgroundPath) {
    try {
      const file = await readFile(job.backgroundPath);
      const image = await loadImage(file);
      const scale = Math.max(WIDTH / image.width, HEIGHT / image.height);
      const w = image.width * scale;
      const h = image.height * scale;
      ctx.drawImage(image, (WIDTH - w) / 2, (HEIGHT - h) / 2, w, h);
    } catch {
      /* keep accent fill */
    }
  } else {
    ctx.fillStyle = "rgba(11,13,20,0.35)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  const avatarSize = 148;
  const ax = job.avatarX * WIDTH;
  const ay = job.avatarY * HEIGHT;
  if (job.avatarUrl) {
    try {
      const response = await fetch(job.avatarUrl);
      if (response.ok) {
        const image = await loadImage(Buffer.from(await response.arrayBuffer()));
        ctx.save();
        ctx.beginPath();
        ctx.arc(ax, ay, avatarSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(image, ax - avatarSize / 2, ay - avatarSize / 2, avatarSize, avatarSize);
        ctx.restore();
      }
    } catch {
      /* avatar optional */
    }
  }

  ctx.strokeStyle = job.textColor.startsWith("#") ? job.textColor : `#${job.textColor}`;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(ax, ay, avatarSize / 2 + 3, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = job.textColor.startsWith("#") ? job.textColor : `#${job.textColor}`;
  ctx.textAlign = "center";
  ctx.font = "700 42px sans-serif";
  ctx.fillText(job.username.slice(0, 32), job.nameX * WIDTH, job.nameY * HEIGHT);
  ctx.font = "400 24px sans-serif";
  const subtitle = job.customText || job.guildName;
  ctx.fillText(subtitle.slice(0, 48), job.nameX * WIDTH, job.nameY * HEIGHT + 40);

  return canvas.toBuffer("image/png");
}
