import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const CONFIG_URL = new URL("../config/post-dynamic-ranges.json", import.meta.url);
const CONFIG_PATH = fileURLToPath(CONFIG_URL);
const FIXED_RECOMMENDATIONS_URL = new URL("../config/blog-post-fixed-recommendations.json", import.meta.url);
const FIXED_RECOMMENDATIONS_PATH = fileURLToPath(FIXED_RECOMMENDATIONS_URL);
const RANGE_PATHS = [
  ["title", "words"],
  ["subtitles", "count"],
  ["subtitles", "words"],
  ["body", "words"],
  ["body", "sections"],
  ["tags", "count"]
];

export class ConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export function loadStructureConfig() {
  return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
}

export function loadFixedBlogRecommendations() {
  return JSON.parse(readFileSync(FIXED_RECOMMENDATIONS_PATH, "utf8"));
}

export function fixedRecommendationsToConfiguration(recommendations) {
  const values = recommendations?.recommendations;
  if (!values) throw new ConfigurationError("Fixed blog recommendations are unavailable.");

  const configuration = {
    title: { words: exactRange(values.title.words) },
    subtitles: {
      count: exactRange(values.subtitles.count),
      words: exactRange(values.subtitles.words)
    },
    body: {
      words: exactRange(values.body.words),
      sections: exactRange(values.body.sections)
    },
    tags: { count: exactRange(values.tags.count) }
  };

  validateConfiguration(configuration);
  return configuration;
}

export function normalizePostType(postType) {
  if (postType === "blog") return "blog";
  if (postType === "social" || postType === "social_media") return "social_media";
  throw new ConfigurationError("postType must be either 'blog' or 'social_media'.");
}

export function getProfile(postType) {
  const normalizedPostType = normalizePostType(postType);
  const profile = loadStructureConfig().profiles[normalizedPostType];

  if (!profile) {
    throw new ConfigurationError(`No structure profile exists for '${normalizedPostType}'.`);
  }

  return structuredClone(profile);
}

export function resolveConfiguration(postType, overrides = {}) {
  if (overrides === null || Array.isArray(overrides) || typeof overrides !== "object") {
    throw new ConfigurationError("configuration must be an object when provided.");
  }

  const configuration = merge(getProfile(postType), overrides);
  validateConfiguration(configuration);
  return configuration;
}

export function setRange(configuration, path, value) {
  const normalizedValue = normalizeRange(value, path.join("."));
  const target = path.slice(0, -1).reduce((current, key) => current[key], configuration);
  target[path.at(-1)] = normalizedValue;
  validateConfiguration(configuration);
  return configuration;
}

export function validateConfiguration(configuration) {
  for (const path of RANGE_PATHS) {
    const value = path.reduce((current, key) => current?.[key], configuration);
    normalizeRange(value, path.join("."));
  }

  const tagRange = configuration.tags.count;
  if (tagRange.min !== 10 || tagRange.max !== 10) {
    throw new ConfigurationError("tags.count must remain exactly 10.");
  }
}

function merge(base, override) {
  const result = structuredClone(base);

  for (const [key, value] of Object.entries(override)) {
    if (!(key in result)) {
      throw new ConfigurationError(`configuration.${key} is not a supported setting.`);
    }

    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = merge(result[key], value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

function normalizeRange(value, label) {
  if (!isPlainObject(value) || !Number.isInteger(value.min) || !Number.isInteger(value.max)) {
    throw new ConfigurationError(`${label} must be an object with integer min and max values.`);
  }

  if (value.min < 0 || value.max < value.min) {
    throw new ConfigurationError(`${label} must have 0 <= min <= max.`);
  }

  return { min: value.min, max: value.max };
}

function exactRange(value) {
  if (!Number.isInteger(value)) {
    throw new ConfigurationError("Fixed recommendations must contain integer values.");
  }

  return { min: value, max: value };
}

function isPlainObject(value) {
  return value !== null && !Array.isArray(value) && typeof value === "object";
}
