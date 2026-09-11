import fs from 'node:fs';
import assert from 'node:assert/strict';
import { normalizePresentation, textDefaults, pageLimit, textBoxHeight, textTop, figureGeometry } from '../web/presentation-settings.js';
import { presentation } from './figure-assets.mjs';
import { paginate } from './story-format.mjs';

const root = new URL('../', import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), 'utf8');

// Existing author configurations remain usable, and importing does not mutate them.
const legacy = structuredClone(presentation);
delete legacy.text; delete legacy.figureScale;
const upgraded = normalizePresentation(legacy);
assert.deepEqual(upgraded.text, textDefaults);
assert.equal(upgraded.figureScale, 1);
assert(!Object.hasOwn(legacy, 'text'));
assert.throws(() => normalizePresentation({ ...presentation, figureScale: 0 }));

// A long page must grow the box, then a short page must release that extra space.
const defaults = normalizePresentation({ ...presentation, figureScale: 1, text: textDefaults });
assert.equal(textBoxHeight(defaults, 300), 440);
assert.equal(textBoxHeight(defaults, 30), 335);
assert.equal(textBoxHeight(defaults, 2000), 936);
const large = normalizePresentation({ ...presentation, text: { ...textDefaults, fontScale: 1.5, nameSize: 72, paddingX: 340, lineHeight: 2 } });
assert(textTop(large) > 12 + large.text.nameSize * 1.1, '名字不能压到正文');
assert(pageLimit(large) < pageLimit(defaults), '放大文字并收窄正文后应缩短分页');
const paragraphs = read('source/original.txt').split(/\n\s*\n/).map(text => text.trim()).filter(Boolean);
for (const paragraph of paragraphs) {
  const pages = paginate(paragraph, pageLimit(large));
  assert.equal(pages.join(''), paragraph, '大字分页不能丢字');
  assert(pages.every(page => page.length <= pageLimit(large) + 2), '大字分页应遵守上限及闭引号余量');
}
const smaller = normalizePresentation({ ...defaults, figureScale: defaults.figureScale * 0.9 });
const before = figureGeometry(defaults, 'witch', { width: 1108, height: 1419 }, 'right');
const after = figureGeometry(smaller, 'witch', { width: 1108, height: 1419 }, 'right');
assert(Math.abs(after.height / before.height - 0.9) < 0.001);
assert.equal(after.x, before.x); assert.equal(after.y, before.y);

// Check the actual built author page, styles, imports and bundled font URLs.
for (const file of ['tune.html', 'tune.js', 'text-layout.js', 'tune-fonts.css']) {
  const content = read(`dist/${file}`);
  const refs = file.endsWith('.html') ? [...content.matchAll(/(?:src|href)="\.\/([^"#?]+)"/g)] :
    file.endsWith('.js') ? [...content.matchAll(/from '\.\/([^']+)'/g)] : [...content.matchAll(/url\(\.\/([^\)]+)\)/g)];
  for (const match of refs) assert(fs.existsSync(new URL(`dist/${match[1]}`, root)), `调整页资源缺失：${match[1]}`);
}
assert.equal(read('dist/tune-textbox.css'), read('game/template/Stage/TextBox/textbox.scss'), '调整页与游戏对话框样式必须一致');
assert(read('dist/index.html').includes('src="./text-layout.js"'), '游戏必须载入实际行高测量');
console.log('演出配置检查通过：旧配置兼容、字号分页无损、对话框增高与回缩、整体缩放、调整页及字体资源有效。');
