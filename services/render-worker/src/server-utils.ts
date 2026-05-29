import type * as http from 'node:http';

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

export function bearer(req: http.IncomingMessage): string | null {
  const auth = req.headers.authorization;
  if (!auth?.toLowerCase().startsWith('bearer ')) return null;
  return auth.slice(7).trim();
}

export function readJsonBody(req: NodeJS.ReadableStream & { destroy?: () => void }, maxBytes = 1024 * 1024): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let settled = false;

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    req.on('data', (c) => {
      const chunk = Buffer.isBuffer(c) ? c : Buffer.from(c);
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        fail(new Error(`Request body too large: ${totalBytes} bytes exceeds ${maxBytes}`));
        req.destroy?.();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (settled) return;
      settled = true;
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (!raw) return resolve({});
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });

    req.on('error', fail);
  });
}

export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export class RenderJobDedupe {
  private readonly active = new Map<string, number>();

  constructor(private readonly ttlMs = 30 * 60 * 1000) {}

  markAccepted(renderJobId: string, now = Date.now()): boolean {
    this.prune(now);
    if (this.active.has(renderJobId)) return false;
    this.active.set(renderJobId, now + this.ttlMs);
    return true;
  }

  markFinished(renderJobId: string): void {
    this.active.delete(renderJobId);
  }

  private prune(now: number): void {
    this.active.forEach((expiresAt, renderJobId) => {
      if (expiresAt <= now) this.active.delete(renderJobId);
    });
  }
}
