import fs from "node:fs/promises";
import path from "node:path";
import { YoutubeTranscript } from "youtube-transcript";
import { createYoutubeFetch } from "./proxy_fetch.mjs";

function arg(name, fallback = undefined) {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function videoIdFrom(input) {
  if (!input) return "";
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;

  try {
    const url = new URL(input);
    if (url.hostname.includes("youtu.be")) {
      return url.pathname.split("/").filter(Boolean)[0] ?? "";
    }
    const shortId = url.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]{11})/);
    return url.searchParams.get("v") ?? shortId?.[1] ?? "";
  } catch {
    return "";
  }
}

async function main() {
  const input = arg("url") ?? arg("video-id");
  const lang = arg("lang", "");
  const out = arg("out", "");
  const videoId = videoIdFrom(input);

  if (!videoId) {
    throw new Error("Pass --url or --video-id.");
  }

  const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
    ...(lang ? { lang } : {}),
    fetch: createYoutubeFetch()
  });
  const text = transcript
    .map((item) => item.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const result = {
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    language: lang || "auto",
    segments: transcript,
    text
  };

  const json = JSON.stringify(result, null, 2);
  if (out) {
    await fs.mkdir(path.dirname(path.resolve(out)), { recursive: true });
    await fs.writeFile(out, json, "utf8");
  }

  console.log(json);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
