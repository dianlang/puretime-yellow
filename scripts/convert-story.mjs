import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { presentation, figureFile } from './figure-assets.mjs';

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

const expressionCues = new Map();
const expressionConfig = JSON.parse(fs.readFileSync(path.join(root, 'game/expressions.json'), 'utf8'));
for (const cue of expressionConfig.cues) {
  const { paragraph, character, expression, quote } = cue;
  if (!Number.isInteger(paragraph) || !paragraphs[paragraph] || /^（\d）$/.test(paragraphs[paragraph])) {
    throw new Error(`表情段落不存在：${paragraph}`);
  }
  if (typeof quote !== 'string' || !quote || !paragraphs[paragraph].includes(quote)) {
    throw new Error(`表情引文与原稿第 ${paragraph} 段不符，请检查索引。`);
  }
  figureFile(character, expression);
  const atParagraph = expressionCues.get(paragraph) ?? {};
  if (Object.hasOwn(atParagraph, character)) throw new Error(`重复表情标注：${paragraph} / ${character}`);
  atParagraph[character] = expression;
  expressionCues.set(paragraph, atParagraph);
}
// 酒保小姐与店员小姐是不同角色；没有立绘的说话人保留画外音。
const figureBySpeaker = new Map(Object.entries(presentation.characters).map(([id,p])=>[p.speaker,id]));
let shotContext;

function getFigureAt(index) {
  if (index < shotContext.from || index > shotContext.to) return undefined;
  const figure = figureBySpeaker.get(speakers.get(index) || '');
  return shotContext.cast.includes(figure) ? figure : undefined;
}

// Score nearby dialogue partners. Existing on-screen partners get a bias so a single
// aside does not cause the whole composition to reshuffle.
function partnerScores(index, currentFigure, currentPair) {
  const scores = new Map();
  const radius = 8;
  for (let d = 1; d <= radius; d++) {
    for (const j of [index - d, index + d]) {
      if (j < 0 || j >= paragraphs.length) continue;
      const figure = getFigureAt(j);
      if (!figure || figure === currentFigure) continue;
      let weight = 1 / (1 + d);
      if (j > index) weight *= 1.05;
      if (currentPair.includes(figure)) weight *= 1.4;
      scores.set(figure, (scores.get(figure) || 0) + weight);
    }
  }
  return scores;
}

function isBriefInterjection(index, figure, currentPair) {
  if (!figure || currentPair.length === 0 || currentPair.includes(figure)) return false;
  let sameSpeakerCount = 0;
  let pairPresence = 0;
  for (let j = Math.max(0, index - 6); j <= Math.min(paragraphs.length - 1, index + 6); j++) {
    const nearby = getFigureAt(j);
    if (nearby === figure) sameSpeakerCount++;
    if (nearby && currentPair.includes(nearby)) pairPresence++;
  }
  return sameSpeakerCount === 1 && pairPresence >= 2;
}

function chooseDialoguePair(index, currentPair) {
  const currentFigure = getFigureAt(index);
  if (!currentFigure) return currentPair;

  // A one-line aside may remain off-screen if the current two-person exchange is clear.
  if (isBriefInterjection(index, currentFigure, currentPair)) return currentPair;

  const scores = partnerScores(index, currentFigure, currentPair);
  const ranked = [...scores.entries()].sort((a,b) => b[1] - a[1]);
  let partner = ranked[0]?.[0];

  // Keep the established partner unless a new partner becomes clearly more relevant.
  if (currentPair.includes(currentFigure)) {
    const established = currentPair.find(f => f !== currentFigure);
    if (established) {
      const establishedScore = scores.get(established) || 0;
      const bestScore = partner ? (scores.get(partner) || 0) : 0;
      if (!partner || partner === established || bestScore < establishedScore * 1.7) {
        partner = established;
      }
    }
  }

  return partner ? [currentFigure, partner] : [currentFigure];
}

function uniqueAvailable(figures) {
  return [...new Set(figures)].filter(name => fs.existsSync(path.join(root, 'game/figure', figureFile(name))));
}

// Two-person VN framing. Witch normally anchors the right side; the others prefer left.
// When two non-witch characters talk, keep a stable left/right convention.
function pairLayout(pair) {
  const figures = uniqueAvailable(pair);
  if (figures.length === 0) return { left:null, right:null };
  if (figures.length === 1) {
    return figures[0] === 'witch'
      ? { left:null, right:figures[0] }
      : { left:figures[0], right:null };
  }

  const a = figures[0], b = figures[1];
  if (a === 'witch' || b === 'witch') {
    const other = a === 'witch' ? b : a;
    return { left:other, right:'witch' };
  }
  if (a === 'clerk' || b === 'clerk') {
    const other = a === 'clerk' ? b : a;
    return { left:'clerk', right:other };
  }
  if (a === 'flower' || b === 'flower') {
    const other = a === 'flower' ? b : a;
    return { left:'flower', right:other };
  }
  return { left:a, right:b };
}

function layoutPair(layout) {
  return [layout.left, layout.right].filter(Boolean);
}

function transitionPair(lines, currentLayout, desiredPair, expressions, currentImages) {
  const desired = pairLayout(desiredPair);
  for (const side of ['left', 'right']) {
    const character = desired[side];
    if (!character) {
      if (currentLayout[side]) lines.push(`changeFigure:none -${side} -exit=exit-to-${side} -exitDuration=260 -next;`);
      currentImages[side] = null;
      continue;
    }
    const file = figureFile(character, expressions[character]);
    if (currentLayout[side] !== character) {
      lines.push(`changeFigure:${file} -${side} -enter=enter-from-${side} -enterDuration=420 -next;`);
    } else if (currentImages[side] !== file) {
      // Same character: replace the expression without moving them off/on stage.
      lines.push(`changeFigure:${file} -${side} -duration=0 -next;`);
    }
    currentImages[side] = file;
  }
  return desired;
}

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
  road: { bg:'road.svg', music:'journey.wav' },
  cafe: { bg:'cafe.svg', music:'memory.wav' },
  parking: { bg:'cafe.svg', music:'memory.wav' },
  store: { bg:'store.svg', music:'night.wav' },
  camp: { bg:'road.svg', music:'journey.wav' },
  station: { bg:'station.svg', music:'night.wav' },
  room: { bg:'room.svg', music:'night.wav' },
  stars: { bg:'stars.svg', music:'night.wav' }
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
  let activeLayout = { left:null, right:null };
  let activeImages = { left:null, right:null };
  let expressions = {};
  let previousSpeaker = '';
  let location = '';

  for (let i = chapter.from; i <= chapter.to; i++) {
    if (cues.has(i)) {
      location = cues.get(i);
      const set = sets[location];
      const nextCue = [...cues.keys()].find(n=>n>i) ?? paragraphs.length;
      shotContext = { from:i, to:Math.min(nextCue-1,chapter.to), cast:presentation.locations[location].cast };
      lines.push(
        'changeFigure:none -left -next;',
        'changeFigure:none -right -next;',
        'changeFigure:none -next;',
        `changeBg:${set.bg} -next;`,
        `bgm:${set.music} -volume=22 -enter=1000 -next;`
      );
      activeLayout = { left:null, right:null };
      activeImages = { left:null, right:null };
      expressions = {};
      previousSpeaker = '';
    }

    if ([91,132,171,300].includes(i)) lines.push('playEffect:tap.wav -volume=25 -next;');
    if ([26,206,349].includes(i)) lines.push('playEffect:chime.wav -volume=30 -next;');

    const segments = paginate(paragraphs[i]);
    if (segments.join('') !== paragraphs[i]) throw new Error(`第 ${i} 段有内容损失`);
    const speaker = speakers.get(i) || '';
    const figure = getFigureAt(i);
    Object.assign(expressions, expressionCues.get(i));

    // Narration keeps the current pair. Dialogue may establish or change a two-person shot.
    const desiredPair = figure ? chooseDialoguePair(i, layoutPair(activeLayout)) : layoutPair(activeLayout);
    activeLayout = transitionPair(lines, activeLayout, desiredPair, expressions, activeImages);

    const target = figure
      ? activeLayout.left === figure ? 'fig-left'
      : activeLayout.right === figure ? 'fig-right'
      : undefined
      : undefined;

    if (speaker && speaker !== previousSpeaker && target) {
      lines.push(`setAnimation:move-front-and-back -target=${target} -keep -next;`);
    }
    previousSpeaker = speaker;

    for (const segment of segments) lines.push(`${speaker}:${escape(segment)};`);
    report.push({paragraph:i, scene:chapter.file, location, figures:layoutPair(activeLayout),
      expressions:Object.fromEntries(layoutPair(activeLayout).map(character=>[character, expressions[character] ?? 'neutral'])), speaker, segments});
  }

  if (chapterIndex < chapters.length - 1) lines.push(`changeScene:${chapters[chapterIndex+1].file};`);
  else lines.push('changeFigure:none -next;', 'changeFigure:none -right -next;', 'changeFigure:none -left -next;', 'changeBg:none -next;', 'bgm:none -enter=1500 -next;', 'intro:未完待续|本次阅读已到达现有原稿末尾;','end;');
  fs.writeFileSync(path.join(outdir, chapter.file), lines.join('\n')+'\n');
}
fs.writeFileSync(path.join(outdir,'source-map.json'), JSON.stringify({paragraphs:paragraphs.length, chapters, dialogue:report},null,2));
console.log(`已转换 ${report.length} 个正文段落 / ${report.reduce((n,p)=>n+p.segments.length,0)} 页 / ${chapters.length} 幕。`);
