import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { sideStories, sideEvents } from './side-story-config.mjs';
import { presentation, figureAssets } from './figure-assets.mjs';
import { paginate } from './story-format.mjs';

const root = new URL('../', import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), 'utf8');
const map = JSON.parse(read('game/scene/source-map.json'));
const originalPages = map.dialogue.flatMap(row => row.segments.map(text => `${row.speaker}:${text};`));
const dialogue = line => line.startsWith(':') || /^(魔女|店员小姐|玛丽安|酒保小姐|小花|掠夺者领队|年长的保安|保安团|长老|电台):/.test(line);
const scenes = new Map();

function scene(file) {
  if (scenes.has(file)) return scenes.get(file);
  assert(/^(?:side\/)?[a-zA-Z0-9_-]+\.txt$/.test(file), `非法场景引用：${file}`);
  const lines = read(`dist/game/scene/${file}`).split('\n');
  const labels = new Map();
  for (const [index, line] of lines.entries()) {
    const label = /^label:([^;]+);$/.exec(line);
    if (label) {
      assert(!labels.has(label[1]), `重复标签：${file} / ${label[1]}`);
      labels.set(label[1], index);
    }
    const ref = /^(changeBg|changeFigure|callScene|changeScene):([^; ]+)/.exec(line);
    if (ref && ref[2] !== 'none') {
      const folder = { changeBg: 'background', changeFigure: 'figure', callScene: 'scene', changeScene: 'scene' }[ref[1]];
      assert(fs.existsSync(new URL(`dist/game/${folder}/${ref[2]}`, root)), `支线素材或场景不存在：${ref[2]}`);
    }
    if (line.startsWith('jumpLabel:')) assert(labels.has(line.slice(10).split(/[ ;]/)[0]) || lines.some(other => other === `label:${line.slice(10).split(/[ ;]/)[0]};`), `跳转目标不存在：${file}`);
    if (line.startsWith('choose:')) {
      for (const option of line.slice(7, -1).split('|')) assert(lines.includes(`label:${option.split(':')[1]};`), `选项目标不存在：${file}`);
    }
  }
  const result = { lines, labels };
  scenes.set(file, result);
  return result;
}

let addedPages = sideStories.choices.reduce((count, choice) => count + paginate(choice.prompt).length, 0);
for (const event of sideEvents) {
  scene(`side/${event.id}.txt`);
  for (const route of event.options ?? event.variants) {
    const file = `side/${event.id}-${route.id}.txt`;
    const actual = scene(file).lines.filter(dialogue);
    const expected = route.lines.flatMap(line => paginate(line.text).map(text => `${line.speaker}:${text};`));
    assert.deepEqual(actual, expected, `支线正文生成不一致：${file}`);
    addedPages += actual.length;
  }
}

// Walk the actual emitted commands for every choice combination. This checks
// scene calls, labels, flags and restoration without pretending to render a browser.
const visitedSideFiles = new Set();
function walk(selection) {
  const state = { images: { left: null, right: null }, transforms: {}, background: 'none' };
  const variables = {}, stack = [], decisions = [], callbacks = [];
  let file = 'start.txt', index = 0, steps = 0, mainPages = 0, optionalPages = 0, finished = false;
  while (!finished) {
    assert(++steps < 12000, '支线发生循环或无法返回主线');
    const current = scene(file), line = current.lines[index++];
    assert(line !== undefined, `场景没有正常返回或结束：${file}`);
    if (!line || line.startsWith(';')) continue;
    const when = / -when=(pt_[a-z_]+)==(-?\d+)/.exec(line);
    if (when && variables[when[1]] !== Number(when[2])) continue;
    if (dialogue(line)) {
      if (!file.startsWith('side/')) assert.equal(line, originalPages[mainPages++], '分支导致主线正文遗漏、重复或乱序');
      else optionalPages++;
      const speaker = line.slice(0, line.indexOf(':'));
      const visible = Object.values(state.images).filter(Boolean).map(asset => figureAssets.get(asset).character);
      const active = visible.find(character => presentation.characters[character].speaker === speaker);
      for (const [side, asset] of Object.entries(state.images)) {
        if (!asset) continue;
        const character = figureAssets.get(asset).character, transform = state.transforms[side];
        assert.equal(transform.alpha, 1, `支线立绘透明：${file}`);
        assert.equal(transform.brightness, !active || active === character ? 1 : 0.8, `支线或返回后聚焦错误：${file}`);
        const scale = Number((presentation.characters[character].scale * presentation.figureScale * (active === character ? 1.025 : 1)).toFixed(4));
        assert.equal(transform.scale.x, scale, `支线角色比例变化：${file}`);
      }
      continue;
    }
    if (line.startsWith('choose:')) {
      const id = path.basename(file, '.txt');
      const event = sideStories.choices.find(choice => choice.id === id);
      assert(event, `未知选项：${file}`);
      const option = event.options[selection[sideStories.choices.indexOf(event)]];
      const emitted = line.slice(7, -1).split('|').map(item => {
        const condition = /^\((pt_[a-z_]+)==(-?\d+)\)->/.exec(item);
        return { content: condition ? item.slice(condition[0].length) : item,
          visible: !condition || variables[condition[1]] === Number(condition[2]) };
      });
      const visible = emitted.filter(item => item.visible).map(item => item.content);
      const expected = event.options.filter(item => !item.when || variables[item.when.variable] === item.when.equals)
        .map(item => `${item.label}:${item.id}`);
      assert.deepEqual(visible, expected, '实际选项及解锁条件与配置不一致');
      assert(visible.includes(`${option.label}:${option.id}`), '玩家不应选中未解锁的选项');
      decisions.push(id);
      index = current.labels.get(option.id);
      assert(Number.isInteger(index), '选项跳转目标不存在');
      continue;
    }
    if (line.startsWith('jumpLabel:')) {
      const target = line.slice(10).split(/[ ;]/)[0];
      index = current.labels.get(target);
      assert(Number.isInteger(index), `跳转目标不存在：${file} / ${target}`);
      continue;
    }
    if (line.startsWith('setVar:')) {
      const match = /^setVar:(pt_[a-z_]+)=(-?\d+)/.exec(line);
      assert(match && !line.includes(' -global'), '选择状态不应跨新游戏残留');
      variables[match[1]] = Number(match[2]);
      continue;
    }
    if (line.startsWith('callScene:')) {
      const target = line.slice(10).split(/[ ;]/)[0];
      stack.push({ file, index, stage: structuredClone(state) });
      file = target; index = 0;
      visitedSideFiles.add(file);
      if (sideStories.callbacks.some(event => file.startsWith(`side/${event.id}-`))) callbacks.push(file);
      continue;
    }
    if (line === 'return;') {
      const caller = stack.pop();
      assert(caller, '支线在主场景误用了 return');
      assert.deepEqual(state, caller.stage, `支线未恢复进入前的立绘、表情、聚焦或背景：${file}`);
      file = caller.file; index = caller.index;
      continue;
    }
    if (line.startsWith('changeScene:')) {
      assert.equal(stack.length, 0, '支线不应替换主线');
      file = line.slice(12, -1); index = 0;
      continue;
    }
    if (line.startsWith('changeFigure:')) {
      const side = line.includes(' -left') ? 'left' : line.includes(' -right') ? 'right' : null;
      if (!side) { assert(line.startsWith('changeFigure:none'), '支线只使用左右两个立绘槽'); continue; }
      const asset = line.slice(13).split(/[ ;]/)[0];
      if (asset === 'none') { state.images[side] = null; delete state.transforms[side]; }
      else {
        assert(figureAssets.has(asset), `支线角色身份未知：${asset}`);
        state.images[side] = asset;
        const transform = /-transform=([^ ]+)/.exec(line);
        if (transform) state.transforms[side] = JSON.parse(transform[1]);
      }
      continue;
    }
    if (line.startsWith('setTransform:')) {
      const match = /^setTransform:([^ ]+) -target=fig-(left|right)/.exec(line);
      assert(match, '不支持的支线变换');
      state.transforms[match[2]] = { ...state.transforms[match[2]], ...JSON.parse(match[1]) };
      continue;
    }
    if (line.startsWith('changeBg:')) { state.background = line.slice(9).split(/[ ;]/)[0]; continue; }
    if (line === 'end;') { finished = true; continue; }
    assert(/^(label|intro|bgm|playEffect):/.test(line), `未验证的命令：${line}`);
  }
  assert.equal(mainPages, originalPages.length, '未读完原稿');
  assert.equal(stack.length, 0, '仍有未返回的支线');
  assert.deepEqual(decisions, sideStories.choices.map(choice => choice.id), '选项未恰好出现一次');
  const expectedCallbacks = [];
  for (const event of sideStories.callbacks) {
    const variant = event.variants.find(route => variables[route.when.variable] === route.when.equals);
    if (variant) expectedCallbacks.push(`side/${event.id}-${variant.id}.txt`);
  }
  assert.deepEqual(callbacks, expectedCallbacks, '后续回应与玩家实际选择不符');
  return optionalPages;
}

let combinations = [{ selections: [], variables: {} }];
for (const choice of sideStories.choices) combinations = combinations.flatMap(prefix => choice.options.flatMap((option, index) =>
  option.when && prefix.variables[option.when.variable] !== option.when.equals ? [] : [{
    selections: [...prefix.selections, index], variables: { ...prefix.variables, [choice.variable]: option.value }
  }]));
const pathLengths = combinations.map(path => walk(path.selections));
for (const file of scenes.keys()) if (file.startsWith('side/')) assert(visitedSideFiles.has(file), `存在无法触发的支线：${file}`);
console.log(`支线检查通过：${combinations.length} 种选择组合均回到主线，共 ${addedPages} 页可选内容，单次增加 ${Math.min(...pathLengths)}–${Math.max(...pathLengths)} 页；后续回应可达，背景和人物状态完整恢复。`);
