import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizePresentation } from '../web/presentation-settings.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const presentation = normalizePresentation(JSON.parse(fs.readFileSync(path.join(root, 'game/presentation.json'), 'utf8')));
export const figureAssets = new Map();

export function pngSize(file) {
  const png = fs.readFileSync(path.join(root, 'game/figure', file));
  if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`不是 PNG：${file}`);
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

for (const [character, profile] of Object.entries(presentation.characters)) {
  const expressions = profile.expressions ?? { neutral: `${character}.png` };
  if (!expressions.neutral) throw new Error(`缺少默认表情：${character}`);
  const base = pngSize(expressions.neutral);
  for (const [expression, file] of Object.entries(expressions)) {
    if (!/^[A-Za-z0-9_-]+\.png$/.test(file)) throw new Error(`立绘文件名不支持：${file}`);
    if (figureAssets.has(file)) throw new Error(`立绘重复映射：${file}`);
    const size = pngSize(file);
    if (size.width !== base.width || size.height !== base.height) {
      throw new Error(`同一角色的表情差分须保持相同画布尺寸：${file}`);
    }
    figureAssets.set(file, { character, expression });
  }
}

export function figureFile(character, expression = 'neutral') {
  const profile = presentation.characters[character];
  const expressions = profile?.expressions ?? { neutral: `${character}.png` };
  if (!profile || !expressions[expression]) throw new Error(`未配置表情：${character} / ${expression}`);
  return expressions[expression];
}
