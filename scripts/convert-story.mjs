import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manuscript = path.join(root, 'source/original.txt');
if (!fs.existsSync(manuscript)) throw new Error('请先把剧本放入 source/original.txt，参见 README.md。');
const paragraphs = fs.readFileSync(manuscript, 'utf8').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
if (paragraphs.length !== 413 || ![25,106,205,321,381].every((p,i) => paragraphs[p] === `（${i+1}）`)) {
  throw new Error('原稿结构发生变化，请同步调整演出索引，避免错配台词。');
}

const speakers = new Map();
function assign(name, indexes) { indexes.forEach(i => speakers.set(i, name)); }
assign('魔女', [16,18,20,22,24,30,32,35,39,41,58,61,63,67,70,76,79,81,83,90,92,96,103,105,113,126,129,131,141,143,145,147,148,149,150,151,152,153,154,155,156,168,172,186,188,197,202,204,213,218,220,261,268,270,278,280,283,287,301,304,306,309,312,314,318,326,334,336,357,359,361,363,365,372,385,389,391,394,399,401,403,405,407,409,411]);
assign('店员小姐', [15,17,54,87,89,117,121,128,130,135,170,173,199,201,232,234,238,242,246,251,285,289,295,299,328,337,377,379]);
assign('玛丽安', [53,56,60,62,64,68,71,85,95,98,100,102,111,124,142,144,160,162,165,183,190,253,319,332,384,387,392,395,397,400,402,404,406,408,412]);
assign('酒保小姐', [28,31,33,36,38,42,44]);
assign('小花', [206,208,210,215,217,349,350,351,352,354,356,360]);
assign('掠夺者领队', [231,236,239,241,243,249,256,259,265,272,274,277,281,298,302,308,310,315]);
assign('年长的保安', [340]);
assign('保安团', [342,343,344]);
assign('长老', [367]);
assign('电台', [133,134,137,138,139,159,164,166]);

// Splitting only changes pagination; concatenating segments reproduces each paragraph exactly.
export function paginate(text, limit = 76) {
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
function escape(text) {
  // WebGAL uses these ASCII characters as syntax. The source uses fullwidth punctuation.
  if (/[;|\\\r\n]/.test(text) || / -[A-Za-z]/.test(text)) throw new Error('发现需人工处理的 WebGAL 控制字符：' + text);
  return text;
}
const sets = {
  road: { bg:'road.svg', figures:['clerk','witch'], music:'journey.wav' },
  cafe: { bg:'cafe.svg', figures:['flower','witch'], music:'memory.wav' },
  parking: { bg:'cafe.svg', figures:['clerk','witch'], music:'memory.wav' },
  store: { bg:'store.svg', figures:['clerk','witch'], music:'night.wav' },
  camp: { bg:'road.svg', figures:['clerk','witch'], music:'journey.wav' },
  station: { bg:'station.svg', figures:['clerk','witch'], music:'night.wav' },
  room: { bg:'room.svg', figures:['clerk','witch'], music:'night.wav' },
  stars: { bg:'stars.svg', figures:['witch'], music:'night.wav' }
};
const cues = new Map([[0,'road'],[26,'parking'],[45,'road'],[107,'store'],[206,'cafe'],[221,'road'],[225,'camp'],[322,'station'],[349,'cafe'],[366,'room'],[382,'stars']]);
const chapters = [
  { file:'start.txt', title:'序章', from:0, to:24 },
  { file:'01.txt', title:'第一节', from:26, to:105 },
  { file:'02.txt', title:'第二节', from:107, to:204 },
  { file:'03.txt', title:'第三节', from:206, to:320 },
  { file:'04.txt', title:'第四节', from:322, to:380 },
  { file:'05.txt', title:'第五节', from:382, to:412 }
];
const report = [];
const outdir = path.join(root, 'game/scene');
fs.mkdirSync(outdir, {recursive:true});
for (const [chapterIndex, chapter] of chapters.entries()) {
  const lines = [`; PureTime·黄 / ${chapter.title}`, `changeFigure:none -left -next;`, `changeFigure:none -right -next;`, `changeFigure:none -next;`, `changeBg:none -next;`, `intro:${chapter.title};`];
  let activeFigures = [];
  for (let i = chapter.from; i <= chapter.to; i++) {
    if (cues.has(i)) {
      const set = sets[cues.get(i)];
      lines.push('changeFigure:none -left -next;', 'changeFigure:none -right -next;', 'changeFigure:none -next;', `changeBg:${set.bg} -next;`, `bgm:${set.music} -volume=22 -enter=1000 -next;`);
      activeFigures = set.figures;
      // At the very beginning, let the unaccompanied narration establish the wasteland.
      if (i !== 0) showFigures(lines, activeFigures);
    }
    if (i === 14) showFigures(lines, activeFigures);
    if ([91,132,171,300].includes(i)) lines.push('playEffect:tap.wav -volume=25 -next;');
    if ([26,206,349].includes(i)) lines.push('playEffect:chime.wav -volume=30 -next;');
    const segments = paginate(paragraphs[i]);
    if (segments.join('') !== paragraphs[i]) throw new Error(`第 ${i} 段有内容损失`);
    const speaker = speakers.get(i) || '';
    for (const segment of segments) lines.push(`${speaker}:${escape(segment)};`);
    report.push({paragraph:i, scene:chapter.file, speaker, segments});
  }
  if (chapterIndex < chapters.length - 1) lines.push(`changeScene:${chapters[chapterIndex+1].file};`);
  else lines.push('changeFigure:none -next;', 'changeFigure:none -right -next;', 'changeFigure:none -left -next;', 'changeBg:none -next;', 'bgm:none -enter=1500 -next;', 'intro:未完待续|本次阅读已到达现有原稿末尾;','end;');
  fs.writeFileSync(path.join(outdir, chapter.file), lines.join('\n')+'\n');
}
function showFigures(lines, figures) {
  // Omit missing art rather than showing a broken image; adding witch.png enables it.
  figures = figures.filter(name => fs.existsSync(path.join(root, `game/figure/${name}.png`)));
  figures.forEach((figure, idx) => {
    const pos = figures.length === 1 ? '' : idx === 0 ? ' -left' : ' -right';
    lines.push(`changeFigure:${figure}.png${pos} -next;`);
  });
}
fs.writeFileSync(path.join(outdir,'source-map.json'), JSON.stringify({paragraphs:paragraphs.length, chapters, dialogue:report},null,2));
console.log(`已转换 ${report.length} 个正文段落 / ${report.reduce((n,p)=>n+p.segments.length,0)} 页 / ${chapters.length} 幕。`);
