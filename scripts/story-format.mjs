import fs from 'node:fs';
import { normalizePresentation, pageLimit } from '../web/presentation-settings.js';
const config = normalizePresentation(JSON.parse(fs.readFileSync(new URL('../game/presentation.json', import.meta.url), 'utf8')));
// Pagination changes reading pages, never the underlying text.
export function paginate(text, limit = pageLimit(config)) {
  const out = [];
  let rest = text;
  while (rest.length > limit) {
    let cut = -1;
    for (let i = limit - 1; i >= Math.floor(limit / 2); i--) {
      if ('。！？；，、…'.includes(rest[i])) { cut = i + 1; break; }
    }
    if (cut < 0) cut = limit;
    while ('”’」』'.includes(rest[cut] || '\0')) cut++;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest) out.push(rest);
  return out;
}

export function escapeDialogue(text) {
  if (/[;|\\\r\n]/.test(text) || / -[A-Za-z]/.test(text)) throw new Error('发现需人工处理的 WebGAL 控制字符：' + text);
  return text;
}
