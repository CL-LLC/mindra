# Kaleidoscope Assets

This directory contains stock kaleidoscope video clips for intro/outro sequences.

## Expected Files

- `kaleidoscope-intro.mp4` - Intro clip (default: 15 seconds)
- `kaleidoscope-outro.mp4` - Outro clip (default: 15 seconds)

## Video Requirements

- Format: MP4 (H.264)
- Resolution: Any (will be scaled to match output video)
- Frame rate: Any (will be converted to match output FPS)
- Audio: Optional (will be stripped - music bed continues from main content)

## Configuration

You can customize the intro/outro clips via the render options:

```typescript
renderVideo(scenes, {
  kaleidoscope: {
    enabled: true, // Enable/disable intro/outro
    introDuration: 15, // seconds
    outroDuration: 15, // seconds
    intro: { id: 'custom-intro', fileName: 'my-intro.mp4', defaultDuration: 10 },
    outro: { id: 'custom-outro', fileName: 'my-outro.mp4', defaultDuration: 12 },
  }
});
```

## Fallback

If stock assets are not found, the renderer will generate synthetic kaleidoscope-style
clips using FFmpeg's geq filter. These create colorful, shifting geometric patterns.

## Adding Custom Assets

1. Place your MP4 files in this directory
2. Name them according to the expected file names, or
3. Configure custom file names via the kaleidoscope options
