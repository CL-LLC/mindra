import fs from 'fs/promises';
import path from 'path';

export type RecordedNarrationAudio = {
  path: string;
  sourceType: 'recorded';
};

export type ResolveRecordedNarrationAudioArgs = {
  tempDir: string;
  sceneIndex: number;
  source?: string;
  mimeType?: string;
  filePrefix?: string;
};

export async function resolveRecordedNarrationAudio({
  tempDir,
  sceneIndex,
  source,
  mimeType,
  filePrefix = 'narration',
}: ResolveRecordedNarrationAudioArgs): Promise<RecordedNarrationAudio | undefined> {
  if (!source) return undefined;

  if (source.startsWith('http://') || source.startsWith('https://')) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to download recorded narration: ${response.status} ${response.statusText}`);
    }

    const detectedMimeType = response.headers.get('content-type') || mimeType || 'audio/webm';
    const outputPath = path.join(tempDir, `${filePrefix}-${sceneIndex}${mimeTypeToExtension(detectedMimeType)}`);
    await fs.writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
    return { path: outputPath, sourceType: 'recorded' };
  }

  const prefix = 'base64,';
  const base64Index = source.indexOf(prefix);
  if (!source.startsWith('data:') || base64Index === -1) return undefined;

  const meta = source.slice(5, base64Index - 1);
  const payload = source.slice(base64Index + prefix.length);
  if (!payload) return undefined;

  const detectedMimeType = meta || mimeType || 'audio/webm';
  const outputPath = path.join(tempDir, `${filePrefix}-${sceneIndex}${mimeTypeToExtension(detectedMimeType)}`);
  await fs.writeFile(outputPath, Buffer.from(payload, 'base64'));
  return { path: outputPath, sourceType: 'recorded' };
}

export function mimeTypeToExtension(mimeType: string): string {
  if (mimeType.includes('webm')) return '.webm';
  if (mimeType.includes('wav')) return '.wav';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return '.mp3';
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return '.m4a';
  if (mimeType.includes('ogg')) return '.ogg';
  return '.webm';
}
