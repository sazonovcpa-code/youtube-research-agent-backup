import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { createYoutubeFetch } from "./proxy_fetch.mjs";

const API_ROOT = "https://www.googleapis.com/youtube/v3";

function arg(name, fallback = undefined) {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function isoDateDaysAgo(days) {
  const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return date.toISOString();
}

function parseDuration(iso) {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function youtube(pathname, params) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    throw new Error("YOUTUBE_API_KEY is missing. Add it to .env.");
  }

  const url = new URL(`${API_ROOT}/${pathname}`);
  for (const [name, value] of Object.entries({ ...params, key })) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(name, String(value));
    }
  }

  const response = await createYoutubeFetch()(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`YouTube API error ${response.status}: ${text}`);
  }

  return response.json();
}

async function main() {
  const cwd = process.cwd();
  const rules = await readJson(path.join(cwd, "config/search_rules.json"));
  const query = arg("query");
  const maxResults = Number(arg("max-results", rules.maxResultsPerQuery));
  const regionCode = arg("region", rules.preferredRegions[0]);
  const relevanceLanguage = arg("language", "en");
  const minViews = Number(arg("min-views", rules.minViews));
  const out = arg("out", "");

  if (!query) {
    throw new Error('Missing --query "..."');
  }

  const publishedAfterDays = rules.publishedAfterDays;
  const search = await youtube("search", {
    part: "snippet",
    type: "video",
    q: query,
    maxResults,
    order: rules.defaultOrder,
    videoDuration: rules.defaultDuration,
    regionCode,
    relevanceLanguage,
    publishedAfter: Number.isFinite(Number(publishedAfterDays)) && Number(publishedAfterDays) > 0
      ? isoDateDaysAgo(Number(publishedAfterDays))
      : undefined,
    safeSearch: "moderate"
  });

  const ids = search.items.map((item) => item.id.videoId).filter(Boolean);
  if (ids.length === 0) {
    console.log(JSON.stringify([], null, 2));
    return;
  }

  const details = await youtube("videos", {
    part: "snippet,contentDetails,statistics",
    id: ids.join(",")
  });

  const rejectPatterns = rules.rejectTitlePatterns.map((pattern) => new RegExp(pattern, "i"));
  const results = details.items.map((item) => {
    const views = Number(item.statistics?.viewCount ?? 0);
    const durationSeconds = parseDuration(item.contentDetails?.duration ?? "");
    const title = item.snippet?.title ?? "";
    const rejectedByTitle = rejectPatterns.some((pattern) => pattern.test(title));

    return {
      videoId: item.id,
      url: `https://www.youtube.com/watch?v=${item.id}`,
      title,
      channelTitle: item.snippet?.channelTitle ?? "",
      channelId: item.snippet?.channelId ?? "",
      publishedAt: item.snippet?.publishedAt ?? "",
      description: item.snippet?.description ?? "",
      thumbnails: item.snippet?.thumbnails ?? {},
      views,
      durationSeconds,
      language: relevanceLanguage,
      region: regionCode,
      query,
      acceptedByBasicFilters: views >= minViews && !rejectedByTitle,
      rejectionReasons: [
        views < minViews ? `views below ${minViews}` : "",
        rejectedByTitle ? "title matches reject pattern" : ""
      ].filter(Boolean)
    };
  });

  const json = JSON.stringify(results, null, 2);
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
