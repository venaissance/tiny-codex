# Image Generation (Nano Banana 2 + OpenRouter)

## Overview
Integrate AI image generation into tiny-codex via OpenRouter's OpenAI-compatible API, using Google's Gemini 3.1 Flash Image Preview ("Nano Banana 2") model.

## Model
- **ID**: `google/gemini-3.1-flash-image-preview`
- **Provider**: OpenRouter
- **Pricing**: $0.50/M input tokens, $3/M output tokens, ~$0.00006/image
- **Context**: 65K tokens
- **Capabilities**: Text-to-image, image editing, multi-turn conversations

## API Integration

### Provider Setup
OpenRouter uses the standard OpenAI chat completions endpoint.

```env
OPENROUTER_API_KEY=sk-or-v1-xxxx
```

```typescript
// src/main/index.ts
if (process.env.OPENROUTER_API_KEY) {
  providers.set('openrouter', new OpenAIModelProvider({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    supportsStreaming: true,
  }));
}
```

### Request Format
Same endpoint as chat completions, with `modalities` parameter:

```json
{
  "model": "google/gemini-3.1-flash-image-preview",
  "messages": [{"role": "user", "content": "Draw a cat under moonlight"}],
  "modalities": ["image", "text"]
}
```

### Response Format
Images returned as base64 data URLs:

```json
{
  "choices": [{
    "message": {
      "content": "Here's the image I generated.",
      "images": [{
        "type": "image_url",
        "image_url": { "url": "data:image/png;base64,iVBORw0KGgo..." }
      }]
    }
  }]
}
```

### Optional Parameters
- `image_config.aspect_ratio`: "1:1", "16:9", etc.
- `image_config.image_size`: "1K", "2K", "4K"

## Implementation Plan

### 1. OpenRouter Provider Registration
Add to `src/main/index.ts` alongside existing providers.

### 2. Model Routing
When Image Gen skill is selected, route to OpenRouter provider with model `google/gemini-3.1-flash-image-preview` and add `modalities: ["image", "text"]` to the request body.

### 3. Response Handling
Parse `images` array from response, decode base64, save to project directory, and display in preview panel.

### 4. UI Integration
- Image Gen skill tag triggers image model routing
- Preview panel shows generated images inline
- Support multi-turn editing ("make the background blue")

### 5. Alternative: Volcengine Seedream
As backup, can use existing Ark provider with Seedream 4.0-5.0 models. Already have Ark API key configured.

## References
- [OpenRouter Image Generation Docs](https://openrouter.ai/docs/guides/overview/multimodal/image-generation)
- [Nano Banana 2 Model Page](https://openrouter.ai/google/gemini-3.1-flash-image-preview)
- [火山引擎模型价格](https://www.volcengine.com/docs/82379/1544106)
