# Changelog

## 0.2.5 — 2026-08-24

- Add reusable John, Melissa, and Radovan author configurations to every template response.
- Support default and selected authors in recommendation mode, direct specific mode, and guided specific mode.

## 0.2.4 — 2026-08-24

- Add reusable Persona A, Persona B, and Persona C writing-style configurations to every template response.
- Support default and selected personas in recommendation mode, direct specific mode, and guided specific mode.

## 0.2.3 — 2026-08-23

- Route public multi-segment API requests to the Vercel catch-all function.

## 0.2.2 — 2026-08-23

- Add a Bun lockfile marker so Vercel selects Bun for dependency installation and function deployment.

## 0.2.1 — 2026-08-23

### Fixed

- Configured Vercel to use the Other framework preset, Bun installation, and the repository's `api/` function entrypoints for production deployment.

## 0.2.0 — 2026-08-23

### Released

- Established recommendation mode as the one-call, self-contained guidance package for external AI agents creating blog posts.
- Added keyword-research workflow, structured keyword brief, query-to-section mapping, and Search Console-informed research guidance to the returned blog package.
- Included canonical drafting, SEO, AI-search, evidence, review, fixed-recommendation, and Markdown-template materials in the documented consumer workflow.
