/**
 * FLUX image provider regression tests.
 *
 * Run with: npx tsx src/lib/video/__tests__/flux-image-provider.test.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ModalFluxGenerator } from '../generators/modal-flux';
import { createVideoGenerators } from '../generators';

async function testFluxEndpointRequired() {
  const generator = new ModalFluxGenerator({ endpointUrl: '', apiKey: undefined });

  await assert.rejects(
    () => generator.generate({
      prompt: 'cinematic mountain sunrise',
      tempDir: os.tmpdir(),
      index: 0,
      width: 1280,
      height: 720,
    }),
    /MODAL_FLUX_ENDPOINT_URL|Flux endpoint/i,
    'Flux image generation must fail fast when the Flux endpoint is not configured'
  );

  console.log('✅ testFluxEndpointRequired passed');
}

async function testCreateVideoGeneratorsUsesFluxEvenWhenOpenAIIsPresent() {
  const generators = createVideoGenerators({
    openaiClient: { images: { generate: () => { throw new Error('OpenAI image generation must not be used'); } } } as any,
    ttsModel: 'tts-1',
    ttsVoice: 'alloy',
    pythonCommand: 'python3',
    shellQuote: (value: string) => `'${value.replace(/'/g, `'\\''`)}'`,
    fallbackRenderer: async () => { throw new Error('Local fallback must not replace Flux generation'); },
  });

  assert.ok(
    generators.imageGenerator instanceof ModalFluxGenerator,
    'Video image generation must be backed by Modal Flux, not an OpenAI image generator'
  );

  console.log('✅ testCreateVideoGeneratorsUsesFluxEvenWhenOpenAIIsPresent passed');
}

async function testFluxRequestAndImageWrite() {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mindra-flux-test-'));
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  try {
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ base64: Buffer.from('fake-png').toString('base64') }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;

    const generator = new ModalFluxGenerator({ endpointUrl: 'https://flux.example/render', apiKey: 'test-token' });
    const imagePath = await generator.generate({
      prompt: 'no text, cinematic ocean sunrise',
      tempDir: tmpDir,
      index: 3,
      width: 1280,
      height: 720,
    });

    assert.equal(imagePath, path.join(tmpDir, 'generated-3.png'));
    assert.equal(await fs.readFile(imagePath!, 'utf8'), 'fake-png');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://flux.example/render');
    assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, 'Bearer test-token');

    const body = JSON.parse(String(calls[0].init?.body));
    assert.equal(body.prompt, 'no text, cinematic ocean sunrise');
    assert.equal(body.seed, 3);
    assert.equal(body.width, 1080);
    assert.equal(body.height, 720);
    assert.equal(body.model, undefined, 'Flux endpoint payload must not specify an OpenAI image model');

    console.log('✅ testFluxRequestAndImageWrite passed');
  } finally {
    globalThis.fetch = originalFetch;
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

async function main() {
  await testFluxEndpointRequired();
  await testCreateVideoGeneratorsUsesFluxEvenWhenOpenAIIsPresent();
  await testFluxRequestAndImageWrite();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
