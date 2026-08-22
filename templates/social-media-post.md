---
type: "Post Template"
template_layer: extension
extends: "post-core"
template_version: "1.0"
channel: social
platform: "{{LINKEDIN|X|INSTAGRAM|FACEBOOK|TIKTOK|OTHER}}"
format: "{{TEXT|THREAD|CAROUSEL|VIDEO_CAPTION|IMAGE_CAPTION}}"
character_limit: "{{PLATFORM_LIMIT_OR_NONE}}"
hashtags: []
media_brief: "{{OPTIONAL_IMAGE_VIDEO_OR_CAROUSEL_DESCRIPTION}}"
---

# Social media extension

Apply this extension on top of [`post-core.md`](post-core.md). Keep all core fields and sections, then replace or complete the shared `# Post` section with the social structure below.

## Social post

**Hook:** {{FIRST_LINE_OR_OPENING_FRAME}}

{{SHORT_FORM_POST_COPY}}

**Call to action:** {{PLATFORM_APPROPRIATE_CTA}}

## Optional sequence

{{THREAD_CAROUSEL_OR_VIDEO_BEAT_SHEET}}

## Social review additions

- **Character count:** {{COUNT_AND_LIMIT}}
- **Hashtag rationale:** {{WHY_THESE_TAGS}}
- **Media and accessibility:** {{ALT_TEXT_CAPTIONS_AND_CREDIT_NOTES}}
- **Platform policy or disclosure review:** {{REVIEW_NOTES}}
