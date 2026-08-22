# Reusable templates

The template system has two layers:

- `post-core.md` — the shared contract used by every post, regardless of channel.
- `blog-post.md` and `social-media-post.md` — use-case extensions that upgrade the core with channel-specific fields and sections.

A consuming project should start with the core, apply exactly one extension, replace the placeholders, preserve the OKF frontmatter, and set a concrete post `type` such as `Blog Post` or `Social Media Post` in the resulting document.

The extensions are deliberately additive. They must not redefine or remove the shared identity, audience, goal, message, CTA, provenance, or review fields from the core.

## Consumption contract

The template is intentionally plain Markdown and has no runtime dependency. Future API work should expose these same capabilities without changing the source format:

- retrieve the current template;
- retrieve the shared core and a selected use-case extension;
- create or fill a composed post from the core plus extension;
- validate required OKF metadata and template fields;
- return the Markdown document and its metadata for rendering or channel adaptation.

The API should be an adapter around this portable file contract, not a replacement for it. External projects must be able to consume the template without importing private repository code.
