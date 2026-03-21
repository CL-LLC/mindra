import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

function safeFilename(input: string) {
  return path.basename(input).replace(/[^a-zA-Z0-9._-]/g, '');
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    const safe = safeFilename(filename);

    if (!safe) {
      return NextResponse.json({ error: 'Invalid video filename' }, { status: 400 });
    }

    const videoPath = path.join(process.cwd(), 'public', 'videos', safe);
    const data = await fs.readFile(videoPath);

    return new NextResponse(data, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(data.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Video fetch failed:', error);
    return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  }
}
