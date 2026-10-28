import path from 'node:path';

export const UPLOADS = path.join(process.cwd(), 'data', 'uploads');

// SVG is left out on purpose: it can carry script and would be served from this site's origin.
export const TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime'
};
