import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sceneDir = path.join(root, 'game/scene');

const figureBySpeaker = new Map([
  ['魔女', 'witch'],
  ['店员小姐', 'clerk'],
  ['酒保小姐', 'clerk'],
  ['玛丽安', 'marian'],
  ['小花', 'flower']
]);

// Visual normalization for the current PNG set. The source drawings have very
// different canvas occupation, so WebGAL's default 1:1 scale makes the witch
// dominate the frame while Marian looks too small.
const profile = {
  witch:  { scale: 0.82 },
  marian: { scale: 1.10 },
  clerk:  { scale: 0.92 },
  flower: { scale: 0.95 }
};

const chapterFiles = ['start.txt','01.txt','02.txt','03.txt','04.txt','05.txt'];
const speakerPattern = /^(魔女|店员小姐|玛丽安|酒保小姐|小花|掠夺者领队|年长的保安|保安团|长老|电台):/;

function baseScale(figure) {
  return profile[figure]?.scale ?? 0.94;
}

function transformFor(figure, active) {
  const base = baseScale(figure);
  const scale = active ? base * 1.025 : base;
  return {
    scale: { x: Number(scale.toFixed(4)), y: Number(scale.toFixed(4)) },
    alpha: active ? 1 : 0.80,
    saturation: active ? 1 : 0.72,
    contrast: active ? 1 : 0.92
  };
}

function transformLine(figure, target, active, duration = 180) {
  return `setTransform:${JSON.stringify(transformFor(figure, active))} -target=${target} -duration=${duration} -next;`;
}

function normalizeFigureLine(line, figure) {
  const side = line.includes(' -left') ? 'left' : line.includes(' -right') ? 'right' : null;
  if (!side || !figure) return line;

  // Let the normalized size be part of the entrance itself. The custom transform
  // also supplies the fade-in, so a second enter animation would fight the focus
  // transform on the same target.
  const transform = JSON.stringify({
    scale: { x: baseScale(figure), y: baseScale(figure) },
    alpha: 1,
    saturation: 1,
    contrast: 1
  });
  return `changeFigure:${figure}.png -${side} -transform=${transform} -duration=300;`;
}

for (const file of chapterFiles) {
  const fullPath = path.join(sceneDir, file);
  if (!fs.existsSync(fullPath)) continue;

  const source = fs.readFileSync(fullPath, 'utf8').split('\n');
  const out = [];
  let left = null;
  let right = null;
  let previousSpeaker = '';

  for (const originalLine of source) {
    let line = originalLine;

    // The previous build added this stock motion. Focus is now handled by a
    // smaller, smoother scale/brightness change, so remove the old bounce.
    if (/^setAnimation:move-front-and-back\s+-target=fig-(left|right)/.test(line)) {
      continue;
    }

    const figureChange = /^changeFigure:([^;\s]+)(.*);$/.exec(line);
    if (figureChange) {
      const content = figureChange[1];
      const args = figureChange[2];
      const side = args.includes(' -left') ? 'left' : args.includes(' -right') ? 'right' : null;

      if (side) {
        if (content === 'none') {
          if (side === 'left') left = null;
          if (side === 'right') right = null;
          previousSpeaker = '';
          out.push(line);
          continue;
        }

        const figure = path.parse(content).name;
        if (side === 'left') left = figure;
        if (side === 'right') right = figure;
        previousSpeaker = '';
        out.push(normalizeFigureLine(line, figure));
        continue;
      }
    }

    const speakerMatch = speakerPattern.exec(line);
    if (speakerMatch) {
      const speaker = speakerMatch[1];
      const figure = figureBySpeaker.get(speaker);
      const target = figure === left ? 'fig-left' : figure === right ? 'fig-right' : null;

      if (speaker !== previousSpeaker && target) {
        if (left) out.push(transformLine(left, 'fig-left', left === figure));
        if (right) out.push(transformLine(right, 'fig-right', right === figure));
      }
      previousSpeaker = speaker;
    }

    out.push(line);
  }

  fs.writeFileSync(fullPath, out.join('\n'));
}

console.log('已应用立绘尺寸统一与说话人聚焦演出。');
