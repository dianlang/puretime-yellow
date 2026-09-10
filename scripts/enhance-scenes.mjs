import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { presentation, figureAssets, pngSize } from './figure-assets.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sceneDir = path.join(root, 'game/scene');

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

function normalizeFigureLine(line, file, figure, expressionChange, active, neutral) {
  const side = line.includes(' -left') ? 'left' : line.includes(' -right') ? 'right' : null;
  if (!side || !figure) return line;

  // Bring the two speaking positions slightly inward from WebGAL's stock anchors.
  // Coordinates use the engine's 2560×1440 design space.
  // WebGAL 4.6.4 fits a PNG to the stage, then anchors -left/-right at the
  // fitted half-width. Transform coordinates are OFFSETS from that anchor.
  const { width, height } = pngSize(file);
  const stage=presentation.stage;
  const fittedWidth=width*Math.min(stage.width/width,stage.height/height);
  const anchor=side==='left' ? fittedWidth/2 : stage.width-fittedWidth/2;
  const x=Number(((side==='left'?stage.leftX:stage.rightX)-anchor).toFixed(3));
  const transform = JSON.stringify({
    position: { x, y:profile[figure]?.y ?? 0 },
    ...transformFor(figure, active, neutral)
  });

  // Let size and position be part of the entrance itself. The custom transform
  // supplies a restrained fade-in, avoiding competing animations on the same target.
  const timing = expressionChange ? '-duration=0 -enterDuration=0 -exitDuration=450' : '-duration=300';
  return `changeFigure:${file} -${side} -transform=${transform} ${timing} -next;`;
}

for (const file of chapterFiles) {
  const fullPath = path.join(sceneDir, file);
  if (!fs.existsSync(fullPath)) continue;

  const source = fs.readFileSync(fullPath, 'utf8').split('\n');
  const out = [];
  let left = null;
  let right = null;
  const currentImages = { left: null, right: null };
  let previousSpeaker = null;

  for (const [index, originalLine] of source.entries()) {
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
          currentImages[side] = null;
          previousSpeaker = null;
          out.push(line);
          continue;
        }

        const asset = figureAssets.get(content);
        if (!asset) throw new Error(`未配置立绘身份：${content}`);
        const figure = asset.character;
        const expressionChange = (side === 'left' ? left : right) === figure && currentImages[side] !== content;
        if (side === 'left') left = figure;
        if (side === 'right') right = figure;
        // Replacing the PNG must preserve the upcoming line's focus state, even
        // when the character is only listening or reacting during narration.
        const nextDialogue = source.slice(index + 1).find(text => text.startsWith(':') || speakerPattern.test(text));
        const nextFigure = figureBySpeaker.get(speakerPattern.exec(nextDialogue ?? '')?.[1]);
        const neutral = !nextFigure || ![left, right].includes(nextFigure);
        previousSpeaker = null;
        if (expressionChange) {
          // WebGAL 4.6.4 snapshots the OLD image's exit settings before loading
          // the replacement. Update that image first (same path/id: no entrance),
          // so its default 450 ms fade cannot overlap the new facial expression.
          out.push(`changeFigure:${currentImages[side]} -${side} -duration=0 -enterDuration=0 -exitDuration=0 -next;`);
        }
        out.push(normalizeFigureLine(line, content, figure, expressionChange, nextFigure === figure, neutral));
        currentImages[side] = content;
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
