# Reusable templates

The template system has two layers:

- `post-core.md` — the shared contract used by every post, regardless of channel.
- `blog-post.md` and `social-media-post.md` — use-case extensions that upgrade the core with channel-specific fields and sections.
- [`../config/post-structure.json`](../config/post-structure.json) — configurable ranges for each structural profile.

A consuming project should start with the core, apply exactly one extension, replace the placeholders, preserve the OKF frontmatter, and set a concrete post `type` such as `Blog Post` or `Social Media Post` in the resulting document.

The extensions are deliberately additive. They must not redefine or add competing metadata to the shared title, content, or tags.

## Minimal content contract

The authoring surface is intentionally minimal:

- `title` — the main title of the post;
- the Markdown body — the post content;
- `tags` — exactly ten tags;
- structure — a main title, subtitles, body sections, and a measurable word-count target.

How the ten tags are created is an implementation detail outside this template contract.

## Structure baselines

The ranges are defined in [`config/post-structure.json`](../config/post-structure.json), not hardcoded in the templates. The current example profiles are:

| Extension | Target length | Subtitle structure |
|---|---:|---|
| Blog | 2,000–4,000 words | 5–10 subtitles/sections |
| Social media | 30–150 words | 1–3 short subtitles/content beats |

Every composed post must retain one main title and satisfy the selected config profile. The final word count, title word count, subtitle count, subtitle word count, body-section count, and tag count should be checkable by a consumer or future API.

## Consumption contract

The template is intentionally plain Markdown and has no runtime dependency. Future API work should expose these same capabilities without changing the source format:

- retrieve the current template;
- retrieve the shared core and a selected use-case extension;
- create or fill a composed post from the core plus extension;
- validate required OKF metadata and template fields;
- return the Markdown document and its metadata for rendering or channel adaptation.

The API should be an adapter around this portable file contract, not a replacement for it. External projects must be able to consume the template without importing private repository code.
