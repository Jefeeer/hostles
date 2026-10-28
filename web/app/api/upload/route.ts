import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { isAdmin } from '@/lib/auth';
import { UPLOADS, TYPES } from '@/lib/uploads';

const MAX = 200 * 1024 * 1024; // 200 MB, enough for a short event video

export async function POST(req: Request) {
  if (!(await isAdmin())) return Response.json({ error: 'Log in first.' }, { status: 401 });
  const file = (await req.formData()).get('file');
  if (!(file instanceof File)) return Response.json({ error: 'No file received.' }, { status: 400 });
  const ext = path.extname(file.name).toLowerCase();
  if (!TYPES[ext]) return Response.json({ error: 'Use JPG, PNG, WEBP, GIF, MP4, WEBM or MOV.' }, { status: 400 });
  if (file.size > MAX) return Response.json({ error: 'File is larger than 200 MB.' }, { status: 400 });

  const base = path.basename(file.name, ext).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'file';
  const name = `${Date.now()}-${base}${ext}`;
  try {
    await mkdir(UPLOADS, { recursive: true });
    await writeFile(path.join(UPLOADS, name), Buffer.from(await file.arrayBuffer()));
  } catch {
    return Response.json({ error: "Uploads aren’t available on this online demo yet. They work when the site runs locally." }, { status: 503 });
  }
  return Response.json({ url: `/uploads/${name}` });
}
