---
name: "youtube-research-script-agent"
description: "Use when the user wants daily YouTube research, source video candidates, transcript-aware summaries, Russian short-form script drafts in the user's style, and search queries for footage."
---

# YouTube Research Script Agent

This skill prepares research and script material before the editing agent starts work.

## Required Context

Read these files before making a digest:

- `AGENTS.md`
- `config/search_rules.json`
- `config/topics.json`
- `config/style_profile.md`
- user reference texts in `references/my_texts/`
- previously seen items in `data/seen_topics.json` and `data/seen_videos.json`
- `data/blocked_details.json`

## Workflow

1. Clarify or infer the topic.
2. Expand the topic into multilingual YouTube queries.
3. Search YouTube with `scripts/youtube_search.mjs`.
4. Filter by views, duration, title quality, and repetition.
5. Reject candidates that reuse a published fact, example, or list sequence from `data/blocked_details.json`.
6. For each promising source, summarize the idea and mark transcript availability.
7. Adapt the idea into a Russian short-form script using the reference style and target length.
8. Generate footage search queries for every visual beat.
9. Save the result in `outputs/daily_digests/`.

## Candidate Rating

Rate each candidate:

- `A` - strong hook, visual, high views, likely reusable idea.
- `B` - useful but needs manual checking.
- `C` - weak or repetitive.
- `Reject` - too long, irrelevant, repeated, low quality, or legally/visually risky.

## Script Rules

- Do not directly translate. Rebuild the idea.
- Keep the source link.
- Do not claim facts that are not present in the source or broadly verifiable.
- Use the user's style references when available.
- Keep scripts short enough for 30-40 seconds.

## Output Format

Use the digest template in `references/digest-template.md`.
