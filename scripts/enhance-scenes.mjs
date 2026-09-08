import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sceneDir = path.join(root, 'game/scene');

const presentation=JSON.parse(fs.readFileSync(path.join(root,'game/presentation.json'),'utf8'));
const figureBySpeaker=new Map(Object.entries(presentation.characters).map(([id,p])=>[p.speaker,id]));

// Visual normalization for the current PNG set. The source drawings have very
// different canvas occupation, so WebGAL's default 1:1 scale makes the witch
// dominate the frame while Marian looks too small.
const profile = presentation.characters;

const chapterFiles = ['start.txt','01.txt','02.txt','03.txt','04.txt','05.txt'];
const speakerPattern = /^(魔女|店员小姐|玛丽安|酒保小姐|小花|掠夺者领队|年长的保安|保安团|长老|电台):/;

function baseScale(figure) {
  return profile[figure]?.scale ?? 0.94;
}

function transformFor(figure, active, neutral=false) {
  const base = baseScale(figure);
  const scale = active ? base * 1.025 : base;
  return {
    scale: { x: Number(scale.toFixed(4)), y: Number(scale.toFixed(4)) },
    alpha: 1,
    brightness: active || neutral ? 1 : 0.80,
    saturation: active || neutral ? 1 : 0.72,
    contrast: active || neutral ? 1 : 0.92
  };
}

function transformLine(figure, target, active, neutral=false, duration = 180) {
  return `setTransform:${JSON.stringify(transformFor(figure, active,neutral))} -target=${target} -duration=${duration} -next;`;
}

function normalizeFigureLine(line, figure) {
  const side = line.includes(' -left') ? 'left' : line.includes(' -right') ? 'right' : null;
  if (!side || !figure) return line;

  // Bring the two speaking positions slightly inward from WebGAL's stock anchors.
  // Coordinates use the engine's 2560×1440 design space.
  // WebGAL 4.6.4 fits a PNG to the stage, then anchors -left/-right at the
  // fitted half-width. Transform coordinates are OFFSETS from that anchor.
  const png=fs.readFileSync(path.join(root,`game/figure/${figure}.png`));
  if (png.subarray(0,8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`不是 PNG：${figure}`);
  const width=png.readUInt32BE(16), height=png.readUInt32BE(20);
  const stage=presentation.stage;
  const fittedWidth=width*Math.min(stage.width/width,stage.height/height);
  const anchor=side==='left' ? fittedWidth/2 : stage.width-fittedWidth/2;
  const x=Number(((side==='left'?stage.leftX:stage.rightX)-anchor).toFixed(3));
  const transform = JSON.stringify({
    position: { x, y:profile[figure]?.y ?? 0 },
    scale: { x: baseScale(figure), y: baseScale(figure) },
    alpha: 1,
    brightness: 1,
    saturation: 1,
    contrast: 1
  });

  // Let size and position be part of the entrance itself. The custom transform
  // supplies a restrained fade-in, avoiding competing animations on the same target.
  return `changeFigure:${figure}.png -${side} -transform=${transform} -duration=300 -next;`;
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
    if (speakerMatch || line.startsWith(':')) {
      const speaker = speakerMatch?.[1] || '';
      const figure = figureBySpeaker.get(speaker);
      const target = figure === left ? 'fig-left' : figure === right ? 'fig-right' : null;

      if (speaker !== previousSpeaker) {
        if (left) out.push(transformLine(left, 'fig-left', !!target && left === figure, !target));
        if (right) out.push(transformLine(right, 'fig-right', !!target && right === figure, !target));
      }
      previousSpeaker = speaker;
    }

    out.push(line);
  }

  fs.writeFileSync(fullPath, out.join('\n'));
}

console.log('已应用立绘尺寸统一、内收构图与说话人聚焦演出。');
