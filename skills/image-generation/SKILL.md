---
name: image-generation
description: Use this skill when the user requests to generate, create, imagine, or visualize images including characters, scenes, products, or any visual content. Supports structured prompts and reference images for guided generation.
---

# Image Generation Skill

## Overview

This skill generates high-quality images using structured prompts and a Python script. The workflow includes creating JSON-formatted prompts and executing image generation with optional reference images.

## Core Capabilities

- Create structured JSON prompts for AIGC image generation
- Support multiple reference images for style/composition guidance
- Generate images through automated Python script execution
- Handle various image generation scenarios (character design, scenes, products, etc.)

## Workflow

### Step 1: Understand Requirements

When a user requests image generation, identify:

- Subject/content: What should be in the image
- Style preferences: Art style, mood, color palette
- Technical specs: Aspect ratio, composition, lighting
- Camera specs: Position, angle, lens, aperture, shot type
- Text overlay: Signs, titles, captions (content, style, font, font_size)
- Reference images: Any images to guide generation

### Step 2: Create Structured Prompt

Generate a structured JSON file in `workspace/outputs/` with naming pattern: `{descriptive-name}.json`

### Step 3: Execute Generation

Call the Python script located under this skill's folder:
```bash
python scripts/generate.py \
  --prompt-file workspace/outputs/prompt-file.json \
  --reference-images /path/to/ref1.jpg /path/to/ref2.png \
  --output-file workspace/outputs/generated-image.jpg
  --aspect-ratio 16:9
```

Parameters:

- `--prompt-file`: Absolute path to JSON prompt file (required)
- `--reference-images`: Absolute paths to reference images (optional, space-separated)
- `--output-file`: Absolute path to output image file (required)
- `--aspect-ratio`: Aspect ratio of the generated image (optional, default: 16:9)

[!NOTE]
Do NOT read the python file, just call it with the parameters.

## Character Generation Example

User request: "Create a Tokyo street style woman character in 1990s"

Create prompt file: `workspace/outputs/asian-woman.json`
```json
{
  "characters": [{
    "gender": "female",
    "age": "mid-20s",
    "ethnicity": "Japanese",
    "body_type": "slender, elegant",
    "facial_features": "delicate features, expressive eyes, subtle makeup with emphasis on lips, long dark hair partially wet from rain",
    "clothing": "stylish trench coat, designer handbag, high heels, contemporary Tokyo street fashion",
    "accessories": "minimal jewelry, statement earrings, leather handbag",
    "era": "1990s"
  }],
  "negative_prompt": "blurry face, deformed, low quality, overly sharp digital look, oversaturated colors, artificial lighting, studio setting, posed, selfie angle",
  "style": "Leica M11 street photography aesthetic, film-like rendering, natural color palette with slight warmth, bokeh background blur, analog photography feel",
  "composition": "medium shot, rule of thirds, subject slightly off-center, environmental context of Tokyo street visible, shallow depth of field isolating subject",
  "lighting": "neon lights from signs and storefronts, wet pavement reflections, soft ambient city glow, natural street lighting, rim lighting from background neons",
  "color_palette": "muted naturalistic tones, warm skin tones, cool blue and magenta neon accents, desaturated compared to digital photography, film grain texture",
  "camera": {
    "position": "eye level",
    "angle": "3/4 view",
    "lens": "35mm",
    "aperture": "f/2.8",
    "shot_type": "medium shot"
  },
  "text": [
    {
      "content": "SHIBUYA",
      "style": "neon glow, blurred bokeh",
      "font": "sans-serif, bold",
      "font_size": "large, storefront sign",
      "color": "#FF69B4",
      "position": "background, upper right",
      "alignment": "left"
    }
  ]
}
```

Execute generation:
```bash
python scripts/generate.py \
  --prompt-file workspace/outputs/asian-woman.json \
  --output-file workspace/outputs/asian-woman-01.jpg \
  --aspect-ratio 2:3
```

With reference images:
```json
{
  "characters": [{
    "gender": "based on [Image 1]",
    "age": "based on [Image 1]",
    "ethnicity": "human from [Image 1] adapted to Star Wars universe",
    "body_type": "based on [Image 1]",
    "facial_features": "matching [Image 1] with slight weathered look from space travel",
    "clothing": "Star Wars style outfit - worn leather jacket with utility vest, cargo pants with tactical pouches, scuffed boots, belt with holster",
    "accessories": "blaster pistol on hip, comlink device on wrist, goggles pushed up on forehead, satchel with supplies, personal vehicle based on [Image 2]",
    "era": "Star Wars universe, post-Empire era"
  }],
  "prompt": "Character inspired by [Image 1] standing next to a vehicle inspired by [Image 2] on a bustling alien planet street in Star Wars universe aesthetic. Character wearing worn leather jacket with utility vest, cargo pants with tactical pouches, scuffed boots, belt with blaster holster. The vehicle adapted to Star Wars aesthetic with weathered metal panels, repulsor engines, desert dust covering, parked on the street. Exotic alien marketplace street with multi-level architecture, weathered metal structures, hanging market stalls with colorful awnings, alien species walking by as background characters. Twin suns casting warm golden light, atmospheric dust particles in air, moisture vaporators visible in distance. Gritty lived-in Star Wars aesthetic, practical effects look, film grain texture, cinematic composition.",
  "negative_prompt": "clean futuristic look, sterile environment, overly CGI appearance, fantasy medieval elements, Earth architecture, modern city",
  "style": "Star Wars original trilogy aesthetic, lived-in universe, practical effects inspired, cinematic film look, slightly desaturated with warm tones",
  "composition": "medium wide shot, character in foreground with alien street extending into background, environmental storytelling, rule of thirds",
  "lighting": "warm golden hour lighting from twin suns, rim lighting on character, atmospheric haze, practical light sources from market stalls",
  "color_palette": "warm sandy tones, ochre and sienna, dusty blues, weathered metals, muted earth colors with pops of alien market colors",
  "technical": {
    "aspect_ratio": "9:16",
    "quality": "high",
    "detail_level": "highly detailed with film-like texture"
  },
  "camera": {
    "position": "eye level, slightly low",
    "angle": "3/4 view from left",
    "lens": "50mm",
    "aperture": "f/4",
    "shot_type": "medium wide shot"
  },
  "text": [
    {
      "content": "MOS EISLEY CANTINA",
      "style": "weathered, rusted metal sign",
      "font": "display, angular",
      "font_size": "medium, 36px equivalent",
      "color": "#C4A35A",
      "position": "background stall awning",
      "alignment": "center"
    },
    {
      "content": "FRESH RONTO",
      "style": "hand-painted, worn",
      "font": "sans-serif",
      "font_size": "small, 24px equivalent",
      "color": "#8B4513",
      "position": "market stall left",
      "alignment": "left"
    }
  ]
}
```

Execute generation:
```bash
python scripts/generate.py \
  --prompt-file workspace/outputs/star-wars-scene.json \
  --reference-images workspace/uploads/character-ref.jpg workspace/uploads/vehicle-ref.jpg \
  --output-file workspace/outputs/star-wars-scene-01.jpg \
  --aspect-ratio 16:9
```

### Step 4: Present Images

Present the generated images directly to the user using markdown format (without "```md" or "```"):
```md
![asian-woman](workspace/outputs/asian-woman-01.jpg)

![star-wars-scene](workspace/outputs/star-wars-scene-01.jpg)
```

## Common Scenarios

Use different JSON schemas for different scenarios.

**Character Design**:
- Physical attributes (gender, age, ethnicity, body type)
- Facial features and expressions
- Clothing and accessories
- Historical era or setting
- Pose and context
- Camera: position, angle, lens, aperture, shot type

**Scene Generation**:
- Environment description
- Time of day, weather
- Mood and atmosphere
- Focal points and composition
- Camera: position, angle, lens, aperture, shot type

**Product Visualization**:
- Product details and materials
- Lighting setup
- Background and context
- Presentation angle
- Camera: position, angle, lens, aperture, shot type

**Text Overlay** (when image contains text):
- text array: content, style, font, font_size, color, position, alignment

## Specific Templates

Read the following template file only when matching the user request.

- [Doraemon Comic](templates/doraemon.md)

## Output Handling

After generation:

- Images are typically saved in `workspace/outputs/`
- Share generated images with user using present_files tool
- Provide brief description of the generation result
- Offer to iterate if adjustments needed

## Camera Specs (Required in Every Prompt)

Include camera/cinematography fields in every JSON prompt for consistent, professional results:

- **camera_position**: Where the camera is placed (eye level, high angle, low angle, bird's eye, worm's eye, Dutch angle)
- **camera_angle**: Viewing angle (front, 3/4 view, side profile, over-the-shoulder)
- **lens**: Focal length or lens type (24mm wide, 35mm, 50mm standard, 85mm portrait, 135mm telephoto)
- **aperture**: f-stop for depth control (f/1.4 shallow bokeh, f/2.8, f/5.6, f/8 balanced, f/16 deep focus)
- **shot_type**: Framing (extreme close-up, close-up, medium shot, medium full shot, full shot, long shot, extreme long shot)

## Text Array (Optional)

When the image contains text overlays, signs, titles, or captions, include a `text` array. Each item:

- **content**: The actual text string (English only)
- **style**: Visual style (bold, italic, outline, shadow, neon, handwritten, typewriter)
- **font**: Font family (serif, sans-serif, display, script, monospace, or specific: Helvetica, Times, etc.)
- **font_size**: Size relative to image (small, medium, large, x-large) or pixel hint (e.g. 48px for title)
- **color**: Hex or description (#FFFFFF, white, gold, neon blue)
- **position**: Placement (center, top-left, bottom-right, overlay on subject)
- **alignment**: text-align (left, center, right)

Example:
```json
"text": [
  {
    "content": "TOKYO NIGHTS",
    "style": "bold, outline with subtle glow",
    "font": "sans-serif, condensed",
    "font_size": "large, 72px equivalent",
    "color": "#FF6B9D",
    "position": "top center overlay",
    "alignment": "center"
  },
  {
    "content": "EST. 1990",
    "style": "italic, subtle",
    "font": "serif",
    "font_size": "small, 18px equivalent",
    "color": "#CCCCCC",
    "position": "bottom right corner",
    "alignment": "right"
  }
]
```

## Notes

- Always use English for prompts regardless of user's language
- JSON format ensures structured, parsable prompts
- Reference images enhance generation quality significantly
- Iterative refinement is normal for optimal results
- For character generation, include the detailed character object plus a consolidated prompt field
- Retry 3 times if the the `scripts/generate.py` fails. Exponential backoff and retry.
