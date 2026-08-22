# Agent instructions

These instructions define the preparation baseline for agents working in this repository.

## Mission

Maintain a portable, human-readable post template and knowledge base for product marketing across blog and social media channels. Posts are represented as Open Knowledge Format (OKF) concept documents: UTF-8 Markdown files with YAML frontmatter and a Markdown body. The template must remain usable by projects outside this repository.

## Before making changes

1. Read the repository `README.md` and the relevant role instructions in this directory.
2. Read `SPEC.md` before creating or editing an OKF document.
3. Read `templates/post-core.md` and the selected use-case extension in `templates/` when creating or changing the post shape.
4. Inspect existing files and preserve unrelated user changes.
5. Keep this preparation phase template- and documentation-only unless the user explicitly asks for implementation.

## OKF rules

- Every concept document must begin with YAML frontmatter delimited by `---`.
- `type` is the only required frontmatter key; use descriptive project types such as `Blog Post` or `Social Media Post`.
- Prefer `title`, `description`, `tags`, `status`, `sources`, and `generated` when applicable.
- Use standard Markdown links for relationships; do not introduce wiki-link syntax.
- Do not use `index.md` or `log.md` as concept documents; they are reserved by OKF.
- Preserve unknown frontmatter keys when editing existing documents.
- Use ISO 8601 timestamps with an explicit UTC offset.
- Distinguish claims from creative copy, and record source material for factual claims.
- Preserve the stable template fields when adapting a post for an external consumer or channel.
- Compose one use-case extension with the shared core; do not create parallel replacements for core fields.

## Content workflow

Research → outline → draft → factual/source review → channel adaptation → human review → publish-ready handoff.

The same post concept may be adapted to multiple channels. Keep the canonical content and metadata together, and make channel-specific variants explicit rather than silently overwriting the source draft.

Agents must not publish, schedule, send, or make external changes unless the user explicitly authorizes that action. When information is uncertain, mark it for review instead of presenting it as verified fact.

## Quality bar

Content should have a clear audience and purpose, accurate claims, useful structure, an appropriate tone, accessible language, and a channel-appropriate length. Avoid invented statistics, unsupported claims, misleading certainty, and unnecessary repetition.

## Handoff

Summarize changed files, unresolved questions, sources used, and any claims requiring human review. Keep generated drafts clearly distinguishable from approved or published content.
