#!/usr/bin/env npx tsx

import assert from 'assert';
import http from 'http';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { resolveRecordedNarrationAudio } from '../recorded-narration-audio';

async function withAudioServer<T>(handler: (url: string) => Promise<T>): Promise<T> {
  const audio = Buffer.from('recorded-user-voice');
  const server = http.createServer((_, response) => {
    response.writeHead(200, { 'content-type': 'audio/webm' });
    response.end(audio);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    return await handler(`http://127.0.0.1:${address.port}/voice.webm`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function testHttpStorageBackedRecordingIsDownloadedAsRecordedAudio() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mindra-recorded-http-'));
  await withAudioServer(async (url) => {
    const result = await resolveRecordedNarrationAudio({
      tempDir,
      sceneIndex: 3,
      source: url,
      mimeType: 'audio/webm',
      filePrefix: 'narration-v2',
    });

    assert.ok(result, 'HTTP storage-backed recordings should resolve instead of falling through to TTS');
    assert.strictEqual(result.sourceType, 'recorded');
    assert.match(result.path, /narration-v2-3\.webm$/);
    assert.strictEqual(await fs.readFile(result.path, 'utf8'), 'recorded-user-voice');
  });
}

async function testDataUrlRecordingStillWorks() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mindra-recorded-data-'));
  const source = `data:audio/wav;base64,${Buffer.from('legacy-data-url-voice').toString('base64')}`;

  const result = await resolveRecordedNarrationAudio({
    tempDir,
    sceneIndex: 1,
    source,
    mimeType: 'audio/wav',
  });

  assert.ok(result, 'legacy data URL recordings should still resolve');
  assert.strictEqual(result.sourceType, 'recorded');
  assert.match(result.path, /narration-1\.wav$/);
  assert.strictEqual(await fs.readFile(result.path, 'utf8'), 'legacy-data-url-voice');
}

async function testInvalidRecordingSourceReturnsUndefinedForTtsFallback() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mindra-recorded-invalid-'));
  const result = await resolveRecordedNarrationAudio({
    tempDir,
    sceneIndex: 0,
    source: 'not-a-recording-url',
    mimeType: 'audio/webm',
  });

  assert.strictEqual(result, undefined, 'invalid/missing recordings should still allow safe TTS fallback');
}

async function main() {
  await testHttpStorageBackedRecordingIsDownloadedAsRecordedAudio();
  await testDataUrlRecordingStillWorks();
  await testInvalidRecordingSourceReturnsUndefinedForTtsFallback();
  console.log('recorded-narration-audio tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
