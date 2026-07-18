# YouTube Research Agent Guidance

This project is a local Codex agent for preparing daily YouTube research and Russian short-form scripts.

## Mission

Find promising YouTube video references, extract available context, avoid repeated topics, adapt ideas into the user's Russian style, and produce a daily digest with source links and search queries for footage.

This agent does not edit videos, download copyrighted videos, publish content, or generate voiceover unless the user explicitly adds that workflow later.

## Daily Output

Create digest files in `outputs/daily_digests/` with:

- source video link;
- title, channel, views, duration, publish date;
- why the idea is useful;
- transcript status;
- Russian adapted script for 30-40 seconds;
- uniqueness notes against `references/my_texts/` and `data/seen_topics.json`;
- search queries for footage by fact or scene.

## Operating Rules

- Never print API keys, tokens, or `.env` contents.
- Read `config/search_rules.json`, `config/topics.json`, and `config/style_profile.md` before making a daily digest.
- Use the user's reference texts in `references/my_texts/` as style guidance.
- Before accepting an idea or adapting a script, check `data/blocked_details.json` and reject any source that repeats a published fact, detail, example, or list sequence.
- Keep source attribution: every adapted script must include the original video URL.
- Avoid direct translation when writing final Russian text. Rebuild the idea in the user's style.
- Prefer facts and details that can be shown visually.
- Reject ideas that are too abstract, too hard to verify, or too similar to existing texts.
- Keep scripts around 30-40 seconds unless the user asks otherwise.

## Verification

When editing scripts or tools:

- run `npm install` if dependencies are missing;
- run `npm run search -- --query "Japan facts" --max-results 3` as a smoke test when a YouTube API key is available;
- do not include secrets in command output or final messages.

## Handoff Style

Be practical and concise. Give the user the digest path and mention how many candidates were found, accepted, and rejected.
