# Content Post Knowledge Base

Reusable baseline for creating blog posts and social media posts as Open Knowledge Format (OKF) concepts for product marketing.

## Status

This repository is intentionally template- and documentation-only for now. No post-generation, publishing, or API server code has been added.

## Core deliverable

The reusable post contract is split into a shared core and use-case extensions: [`templates/post-core.md`](templates/post-core.md), [`templates/blog-post.md`](templates/blog-post.md), and [`templates/social-media-post.md`](templates/social-media-post.md). The core is shared by every post; an extension adds the structure needed for a specific channel. The authoring surface intentionally stays focused on the main title, post content, and ten tags.

## Repository layout

- `SPEC.md` — local copy of the upstream Open Knowledge Format v0.2 specification.
- `AGENTS/` — working instructions for agents contributing to this project.
- `templates/` — reusable post templates and their consumption contract.
- `posts/` — reserved for future OKF post concepts.

## Working agreement

Treat `SPEC.md` as the structural source of truth for OKF documents. Treat the instructions in `AGENTS/` as the project workflow source of truth. New content should be reviewable as plain Markdown and should preserve provenance, status, and links where applicable.

## External consumption direction

The template is designed to become a portable content contract, not a repository-only convention. Future integration work may expose it through a read-only API or another adapter, but must preserve the same Markdown/OKF representation and stable metadata fields. External consumers should be able to retrieve the template, create a post from it, and validate or render the result without depending on this repository’s internal implementation.

## Upstream reference

The specification was obtained from [GoogleCloudPlatform/knowledge-catalog](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md).
