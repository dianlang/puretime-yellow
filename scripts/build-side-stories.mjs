import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { presentation, figureAssets, figureFile } from './figure-assets.mjs';
import { enhanceScene, transformFor } from './enhance-scenes.mjs';
import { paginate, escapeDialogue } from './story-format.mjs';
import { sideStories, sideEvents } from './side-story-config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'game/scene/side');
const sourceMap = JSON.parse(fs.readFileSync(path.join(root, 'game/scene/source-map.json'), 'utf8'));
const written = new Set();

function imagesFor(cast, expressions = {}) {
  const images = { left: null, right: null };
  for (const [index, character] of cast.entries()) {
    const side = cast.length === 1 && character === 'witch' ? 'right' : index === 0 ? 'left' : 'right';
    images[side] = figureFile(character, expressions[character]);
  }
  return images;
}

function imageCommands(from, to) {
  return ['left', 'right'].filter(side => from[side] !== to[side])
    .map(side => `changeFigure:${to[side] ?? 'none'} -${side} -next;`);
}

function focusLines(images, speaker) {
  const visible = Object.values(images).filter(Boolean).map(file => figureAssets.get(file).character);
  const active = visible.find(character => presentation.characters[character].speaker === speaker);
  return Object.entries(images).filter(([, file]) => file).map(([side, file]) => {
    const character = figureAssets.get(file).character;
    return `setTransform:${JSON.stringify(transformFor(character, character === active, !active))} -target=fig-${side} -duration=0 -next;`;
  });
}

function contextFor(event) {
  const row = sourceMap.dialogue.find(row => row.paragraph === event.afterParagraph);
  assert(row, `支线段落未生成：${event.id}`);
  for (const character of event.cast) assert(presentation.locations[row.location].cast.includes(character), `支线人物误入场景：${event.id}`);
  const main = fs.readFileSync(path.join(root, 'game/scene', row.scene), 'utf8').split('\n');
  const call = main.indexOf(`callScene:side/${event.id}.txt;`);
  assert(call >= 0, `支线缺少主线入口：${event.id}`);
  const background = main.slice(0, call).filter(line => line.startsWith('changeBg:')).at(-1).match(/^changeBg:([^; ]+)/)[1];
  return { images: imagesFor(row.figures, row.expressions), speaker: row.speaker, background };
}

function write(id, lines) {
  written.add(`${id}.txt`);
  fs.writeFileSync(path.join(outDir, `${id}.txt`), lines.join('\n') + '\n');
}

function linearScene(id, lines, entry, cast, setVariable) {
  const inherited = Object.fromEntries(Object.values(entry.images).filter(Boolean).map(file => {
    const asset = figureAssets.get(file); return [asset.character, asset.expression];
  }));
  const images = imagesFor(cast, inherited);
  const raw = [`; 新增可选支线：${id}`, ...imageCommands(entry.images, images)];
  if (setVariable) raw.push(`setVar:${setVariable.name}=${setVariable.value} -next;`);
  for (const line of lines) {
    if (line.expression) {
      const side = Object.keys(images).find(side => images[side] && presentation.characters[figureAssets.get(images[side]).character].speaker === line.speaker);
      const character = figureAssets.get(images[side]).character;
      const file = figureFile(character, line.expression);
      if (file !== images[side]) raw.push(`changeFigure:${file} -${side} -next;`);
      images[side] = file;
    }
    for (const text of paginate(line.text)) raw.push(`${line.speaker}:${escapeDialogue(text)};`);
  }
  raw.push(...imageCommands(images, entry.images));
  write(id, [...enhanceScene(raw, entry.images), ...focusLines(entry.images, entry.speaker), 'return;']);
}

export function buildSideStories() {
  fs.mkdirSync(outDir, { recursive: true });
  for (const event of sideEvents) {
    const entry = contextFor(event);
    if (event.options) {
      const expressions = Object.fromEntries(Object.values(entry.images).filter(Boolean).map(file => {
        const asset = figureAssets.get(file); return [asset.character, asset.expression];
      }));
      const choiceImages = imagesFor(event.cast, expressions);
      const intro = [...imageCommands(entry.images, choiceImages)];
      if (event.background) intro.push(`changeBg:${event.background} -next;`);
      for (const text of paginate(event.prompt)) intro.push(`:${escapeDialogue(text)};`);
      const wrapper = [`; 新增可选支线：${event.title}`, ...enhanceScene(intro, entry.images),
        `choose:${event.options.map(option => `${option.when ? `(${option.when.variable}==${option.when.equals})->` : ''}${option.label}:${option.id}`).join('|')};`];
      for (const option of event.options) {
        const child = `${event.id}-${option.id}`;
        linearScene(child, option.lines, { images: choiceImages, speaker: '' }, event.cast, { name: event.variable, value: option.value });
        wrapper.push(`label:${option.id};`, `callScene:side/${child}.txt;`, 'jumpLabel:finish;');
      }
      wrapper.push('label:finish;', ...enhanceScene(imageCommands(choiceImages, entry.images), choiceImages), ...focusLines(entry.images, entry.speaker));
      if (event.background) wrapper.push(`changeBg:${entry.background} -next;`);
      wrapper.push('return;');
      write(event.id, wrapper);
    } else {
      const wrapper = [`; 新增选择回应：${event.id}`];
      for (const variant of event.variants) wrapper.push(`jumpLabel:${variant.id} -when=${variant.when.variable}==${variant.when.equals};`);
      wrapper.push('jumpLabel:finish;');
      for (const variant of event.variants) {
        const child = `${event.id}-${variant.id}`;
        linearScene(child, variant.lines, entry, event.cast);
        wrapper.push(`label:${variant.id};`, `callScene:side/${child}.txt;`, 'jumpLabel:finish;');
      }
      wrapper.push('label:finish;', 'return;');
      write(event.id, wrapper);
    }
  }
  for (const name of fs.readdirSync(outDir)) {
    if (name.endsWith('.txt') && !written.has(name)) fs.rmSync(path.join(outDir, name));
  }
  console.log(`已生成 ${sideStories.choices.length} 处支线选择、${sideStories.callbacks.length} 处后续回应。`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) buildSideStories();
