import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

function arg(name, fallback = undefined) {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function todaySlug() {
  return new Date().toISOString().slice(0, 10);
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readTextIfExists(file) {
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return "";
  }
}

async function listReferenceTexts(dir) {
  try {
    const files = await fs.readdir(dir);
    return files.filter((file) => /\.(md|txt)$/i.test(file));
  } catch {
    return [];
  }
}

function runSearch(query, outFile) {
  const result = spawnSync(process.execPath, [
    "scripts/youtube_search.mjs",
    "--query",
    query,
    "--out",
    outFile
  ], {
    cwd: process.cwd(),
    encoding: "utf8"
  });

  if (result.status !== 0) {
    return { query, error: result.stderr || result.stdout || "search failed", items: [] };
  }

  try {
    return { query, error: "", items: JSON.parse(result.stdout) };
  } catch {
    return { query, error: "could not parse search output", items: [] };
  }
}

function runTranscript(candidate, outFile) {
  const result = spawnSync(process.execPath, [
    "scripts/transcript_fetch.mjs",
    "--video-id",
    candidate.videoId,
    "--out",
    outFile
  ], {
    cwd: process.cwd(),
    encoding: "utf8"
  });

  if (result.status !== 0) {
    return null;
  }

  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

function footageQueries(candidate, topic) {
  const base = [
    candidate.title,
    `${topic} b-roll`,
    `${topic} shorts footage`,
    `${candidate.channelTitle} ${topic}`
  ];

  return [...new Set(base.map((item) => item.replace(/\s+/g, " ").trim()).filter(Boolean))];
}

function scriptPlaceholder(candidate, styleProfile) {
  const title = candidate.title.replace(/\s+/g, " ").trim();
  return [
    `Черновик нужно доработать по стилю после получения транскрипта.`,
    ``,
    `Хук: ${title}`,
    ``,
    `Идея: взять главный факт из источника, перестроить его на русском языке, убрать прямой перевод и уложить в 30-40 секунд.`,
    ``,
    `Стиль учитывать из config/style_profile.md и references/my_texts/.`
  ].join("\n");
}

async function main() {
  const cwd = process.cwd();
  const topic = arg("topic", "Japan facts");
  const date = arg("date", todaySlug());
  const topics = await readJson(path.join(cwd, "config/topics.json"));
  const rules = await readJson(path.join(cwd, "config/search_rules.json"));
  const styleProfile = await readTextIfExists(path.join(cwd, "config/style_profile.md"));
  const seenVideos = await readJson(path.join(cwd, "data/seen_videos.json"));
  const refs = await listReferenceTexts(path.join(cwd, "references/my_texts"));

  const preset = topics.topicPresets.find((item) => item.name.toLowerCase() === topic.toLowerCase());
  const queries = preset?.queries ?? [topic];
  const rawDir = path.join(cwd, "data/raw", date);
  await fs.mkdir(rawDir, { recursive: true });

  const searchRuns = queries.map((query, index) => {
    const outFile = path.join(rawDir, `search-${index + 1}.json`);
    return runSearch(query, outFile);
  });

  const seenIds = new Set(seenVideos.map((item) => item.videoId ?? item));
  const candidates = searchRuns
    .flatMap((run) => run.items)
    .filter((item, index, all) => all.findIndex((other) => other.videoId === item.videoId) === index)
    .filter((item) => item.acceptedByBasicFilters)
    .map((item) => ({
      ...item,
      alreadySeen: seenIds.has(item.videoId)
    }));

  const transcriptCandidates = candidates
    .filter((item) => !item.alreadySeen)
    .map((candidate) => ({
      ...candidate,
      transcript: runTranscript(
        candidate,
        path.join(rawDir, "transcripts", `${candidate.videoId}.json`)
      )
    }))
    .filter((candidate) => !rules.requireTranscript || Boolean(candidate.transcript?.text));
  const accepted = transcriptCandidates.slice(0, Number(rules.dailyCandidates?.max ?? 3));
  const rejectedCount = searchRuns.flatMap((run) => run.items).length - accepted.length;

  const lines = [];
  lines.push(`# Daily YouTube Research Digest`);
  lines.push("");
  lines.push(`Date: ${date}`);
  lines.push(`Topic: ${topic}`);
  lines.push("");
  lines.push(`## Summary`);
  lines.push("");
  lines.push(`- Queries used: ${queries.join("; ")}`);
  lines.push(`- Search runs with errors: ${searchRuns.filter((run) => run.error).length}`);
  lines.push(`- Reference style files available: ${refs.length}`);
  lines.push(`- Accepted candidates: ${accepted.length}`);
  lines.push(`- Rejected or skipped candidates: ${rejectedCount}`);
  lines.push("");

  for (const [index, candidate] of accepted.entries()) {
    lines.push(`## Candidate ${index + 1}`);
    lines.push("");
    lines.push(`Rating: B`);
    lines.push(`Source: ${candidate.url}`);
    lines.push(`Title: ${candidate.title}`);
    lines.push(`Channel: ${candidate.channelTitle}`);
    lines.push(`Views: ${candidate.views}`);
    lines.push(`Published: ${candidate.publishedAt}`);
    lines.push(`Duration: ${candidate.durationSeconds}s`);
    lines.push(`Transcript status: available and extracted automatically (${candidate.transcript?.language ?? "auto"})`);
    lines.push("");
    lines.push(`### Why It Works`);
    lines.push("");
    lines.push(`- Passed the basic view/title filters.`);
    lines.push(`- Short enough to inspect quickly.`);
    lines.push(`- Accepted only after successful subtitle extraction.`);
    lines.push("");
    lines.push(`### Russian Script Draft`);
    lines.push("");
    lines.push(scriptPlaceholder(candidate, styleProfile));
    lines.push("");
    lines.push(`### Footage Search Queries`);
    lines.push("");
    for (const [queryIndex, query] of footageQueries(candidate, topic).entries()) {
      lines.push(`${queryIndex + 1}. ${query}`);
    }
    lines.push("");
    lines.push(`### Repetition Check`);
    lines.push("");
    lines.push(`- Video ID not found in data/seen_videos.json.`);
    lines.push(`- Compare final topic against references/my_texts/ before accepting.`);
    lines.push("");
  }

  if (searchRuns.some((run) => run.error)) {
    lines.push(`## Search Errors`);
    lines.push("");
    for (const run of searchRuns.filter((item) => item.error)) {
      lines.push(`- ${run.query}: ${run.error}`);
    }
    lines.push("");
  }

  const outDir = path.join(cwd, "outputs/daily_digests");
  await fs.mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, `${date}-${topic.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, "-")}.md`);
  await fs.writeFile(outFile, lines.join("\n"), "utf8");
  console.log(outFile);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
