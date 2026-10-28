import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { UPLOADS, TYPES } from '@/lib/uploads';

// Serves files uploaded from the admin (public/ is only read at build time in production).
export async function GET(req: Request, { params }: { params: Promise<{ file: string }> }) {
  const name = path.basename((await params).file);
  const type = TYPES[path.extname(name).toLowerCase()];
  if (!type) return new Response('Not found', { status: 404 });
  let data: Buffer;
  try { data = await readFile(path.join(UPLOADS, name)); } catch { return new Response('Not found', { status: 404 }); }

  const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=31536000, immutable' };
  // Range support so uploaded videos can be scrubbed (Safari requires it to play at all).
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') ?? '');
  if (range) {
    const start = range[1] ? +range[1] : Math.max(0, data.length - +range[2]);
    const end = range[1] && range[2] ? Math.min(+range[2], data.length - 1) : data.length - 1;
    if (start > end || start >= data.length) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${data.length}` } });
    return new Response(new Uint8Array(data.subarray(start, end + 1)), { status: 206, headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${data.length}`, 'Content-Length': String(end - start + 1) } });
  }
  return new Response(new Uint8Array(data), { headers: { ...headers, 'Content-Length': String(data.length) } });
}
