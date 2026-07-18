# YouTube Research & Script Agent

This local Codex project prepares daily YouTube research digests for short-form videos.

## What It Does

- Searches YouTube through the YouTube Data API.
- Filters candidates by views, duration, language, region, and keywords.
- Stores seen videos and topics.
- Creates a digest with source links, Russian script drafts, and footage search queries.
- Uses your reference texts in `references/my_texts/` to match style.

## First Setup

The YouTube API key is stored locally in `.env`.

If your network cannot reach YouTube reliably, add an HTTP or HTTPS proxy locally:

```text
YOUTUBE_PROXY_URL=http://username:password@host:port
```

Do not put the proxy address in chat or commit it to the repository. The agent uses it for both YouTube search and subtitle extraction.

Install dependencies:

```powershell
npm install
```

Run a smoke test:

```powershell
npm run search -- --query "Japan facts" --max-results 3
```

Create a daily digest:

```powershell
npm run digest -- --topic "Japan unusual facts"
```

## Where To Put Your Texts

Add your previous scripts as `.txt` or `.md` files here:

```text
references/my_texts/
```

The agent will use them as style examples and as a repetition check.

## Main Files

- `AGENTS.md` - durable behavior rules for Codex.
- `skills/youtube-research-script-agent/SKILL.md` - reusable workflow.
- `config/search_rules.json` - search and filtering settings.
- `config/topics.json` - topic presets and multilingual queries.
- `config/style_profile.md` - style rules for Russian adaptation.
- `scripts/youtube_search.mjs` - YouTube API search.
- `scripts/make_digest.mjs` - daily digest generator.

## Important Limits

YouTube Data API provides search results and metadata. It does not reliably provide the spoken transcript for every video. When transcript extraction is unavailable, the digest marks the candidate as needing manual transcript/audio input.
