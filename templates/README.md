# Reusable templates

`post-template.md` is the channel-neutral starting point for a product-marketing post. A consuming project should copy it, replace the placeholders, preserve the OKF frontmatter, and set a concrete post `type` such as `Blog Post` or `Social Media Post`.

## Consumption contract

The template is intentionally plain Markdown and has no runtime dependency. Future API work should expose these same capabilities without changing the source format:

- retrieve the current template;
- create or fill a post from the template;
- validate required OKF metadata and template fields;
- return the Markdown document and its metadata for rendering or channel adaptation.

The API should be an adapter around this portable file contract, not a replacement for it. External projects must be able to consume the template without importing private repository code.
