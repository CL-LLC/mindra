/**
 * FLUX render smoke test.
 *
 * Runs the local FFmpeg render path with a mocked Modal FLUX endpoint and verifies
 * an MP4 buffer is produced without using OpenAI image generation.
 *
 * Run with: npx tsx src/lib/video/__tests__/flux-render-smoke.ts
 */
import assert from 'node:assert/strict';

const tinyPngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

async function main() {
  process.env.MODAL_FLUX_ENDPOINT_URL = 'https://flux.example/render';
  process.env.MODAL_FLUX_API_KEY = 'test-token';
  process.env.OPENAI_API_KEY = '';
  process.env.MINDRA_PIPELINE_VERSION = '1';

  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ base64: tinyPngBase64 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;

    const { renderVideo } = await import('../render-executor');
    const videoBuffer = await renderVideo(
      [
        {
          affirmation: 'I create with calm focus',
          duration: 1,
          title: 'Calm creator',
          description: 'A luminous desk by a window at sunrise',
          imagePrompt: 'cinematic sunrise workspace, no text, no watermark',
        },
      ],
      {
        width: 320,
        height: 180,
        fps: 12,
        quality: 'low',
        kaleidoscope: { enabled: false },
      }
    );

    assert.ok(videoBuffer.length > 1024, 'render should produce a non-empty MP4 buffer');
    assert.equal(calls.length, 1, 'render should request exactly one Flux image for one scene');
    assert.equal(calls[0].url, 'https://flux.example/render');
    const body = JSON.parse(String(calls[0].init?.body));
    assert.equal(body.model, undefined, 'Flux render payload must not specify an OpenAI image model');

    console.log(`✅ flux render smoke passed (${videoBuffer.length} bytes)`);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
