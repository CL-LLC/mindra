import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { readJsonBody, RenderJobDedupe } from './server-utils';

function reqFromChunks(chunks: Array<string | Buffer>): Readable {
  return Readable.from(chunks);
}

async function testReadJsonBodyAcceptsValidJson() {
  const body = await readJsonBody(reqFromChunks(['{"ok":', 'true}']), 1024);
  assert.deepEqual(body, { ok: true });
  console.log('✅ testReadJsonBodyAcceptsValidJson passed');
}

async function testReadJsonBodyRejectsOversizePayload() {
  await assert.rejects(
    () => readJsonBody(reqFromChunks(['{"payload":"', 'x'.repeat(32), '"}']), 16),
    /Request body too large/i
  );
  console.log('✅ testReadJsonBodyRejectsOversizePayload passed');
}

function testRenderJobDedupePreventsDuplicateActiveJobs() {
  const dedupe = new RenderJobDedupe(60_000);
  assert.equal(dedupe.markAccepted('job-1'), true);
  assert.equal(dedupe.markAccepted('job-1'), false);
  dedupe.markFinished('job-1');
  assert.equal(dedupe.markAccepted('job-1'), true);
  console.log('✅ testRenderJobDedupePreventsDuplicateActiveJobs passed');
}

async function main() {
  await testReadJsonBodyAcceptsValidJson();
  await testReadJsonBodyRejectsOversizePayload();
  testRenderJobDedupePreventsDuplicateActiveJobs();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
