import { readFileSync } from "node:fs";

const CORE_URL = new URL("../templates/post-core.md", import.meta.url);
const EXTENSION_URLS = {
  blog: new URL("../templates/blog-post.md", import.meta.url),
  social_media: new URL("../templates/social-media-post.md", import.meta.url)
};

export function composeTemplate(postType, configuration, {
  configurationField = "dynamic_ranges_config",
  configurationReference = "config/post-dynamic-ranges.json"
} = {}) {
  const core = readTemplate(CORE_URL);
  const extension = readTemplate(EXTENSION_URLS[postType]);
  const contentFrontmatter = core.frontmatter
    .split("\n")
    .filter((line) => !/^(type|template_layer|template_version|dynamic_ranges_config|structure_profile):/.test(line));
  const extensionBody = extension.body.replace(/^# .*\n\n.*?\n\n/s, "").trim();
  const type = postType === "blog" ? "Blog Post" : "Social Media Post";

  const combined = [
    "---",
    `type: \"${type}\"`,
    "template_version: \"1.4\"",
    `${configurationField}: "${configurationReference}"`,
    `structure_profile: \"${postType}\"`,
    ...contentFrontmatter,
    "resolved_structure:",
    ...toYaml(configuration, 2),
    "---",
    core.body.trim(),
    "",
    extensionBody
  ].join("\n");

  return {
    core: core.raw,
    extension: extension.raw,
    combined
  };
}

function readTemplate(url) {
  const raw = readFileSync(url, "utf8");
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!match) {
    throw new Error(`Template '${url.pathname}' does not contain YAML frontmatter.`);
  }

  return { raw, frontmatter: match[1], body: match[2] };
}

function toYaml(value, indent) {
  return Object.entries(value).flatMap(([key, child]) => {
    const prefix = " ".repeat(indent);
    if (child !== null && typeof child === "object" && !Array.isArray(child)) {
      return [`${prefix}${key}:`, ...toYaml(child, indent + 2)];
    }

    return [`${prefix}${key}: ${JSON.stringify(child)}`];
  });
}
