import { normalizePresentation, presentationVariables, textRanges, playerFontSizes, pageLimit, textBoxHeight, figureGeometry } from './presentation-settings.js';

const $ = id => document.getElementById(id);
const stage = $('preview-stage');
let original, config, selected = 'witch', queued = false;
const expressions = {}, sliders = [];
const names = { fontScale: '正文字号倍率', nameSize: '名字字号', lineHeight: '行距', letterSpacing: '字距', boxHeight: '对话框最低高度', paddingX: '左右留白', paddingTop: '正文上方留白', paddingBottom: '正文下方留白' };

function status(message) { $('status').textContent = message; }
function schedule() {
  if (!queued) { queued = true; requestAnimationFrame(render); }
}

function slider(parent, label, range, read, write) {
  const row = document.createElement('div'); row.className = 'slider';
  const line = document.createElement('label');
  const id = `tune-${sliders.length}`;
  const title = document.createElement('span'); title.textContent = label;
  const numeric = document.createElement('input'); numeric.type = 'number'; numeric.setAttribute('aria-label', `${label}数值`);
  const input = document.createElement('input'); input.type = 'range'; input.id = id;
  line.htmlFor = id;
  for (const item of [input, numeric]) {
    [item.min, item.max, item.step] = range;
    item.addEventListener('input', () => {
      if (item.value === '' || !item.validity.valid) return;
      write(Number(item.value)); sync(); schedule(); status('有未导出的调整。');
    });
    item.addEventListener('change', () => { if (!item.validity.valid || item.value === '') sync(); });
  }
  const sync = () => { input.value = read(); numeric.value = read(); };
  sliders.push(sync); sync();
  line.append(title, numeric); row.append(line, input); parent.append(row);
}

function fill(select, items, value) {
  select.replaceChildren(...items.map(([id, label]) => {
    const option = document.createElement('option'); option.value = id; option.textContent = label; return option;
  }));
  select.value = value;
}

function updateExpressions() {
  const entries = Object.keys(config.characters[selected].expressions ?? { neutral: `${selected}.png` });
  fill($('expression'), entries.map(id => [id, { neutral: '默认', happy: '开心', angry: '生气', surprise: '惊讶' }[id] ?? id]), expressions[selected] ?? 'neutral');
}

function renderFigure(side) {
  const id = $(`${side}-character`).value;
  const image = $(`figure-${side}`);
  if (!id) { image.hidden = true; return null; }
  const profile = config.characters[id];
  const expression = expressions[id] ?? 'neutral';
  const file = (profile.expressions ?? { neutral: `${id}.png` })[expression];
  const src = `./game/figure/${file}`;
  if (image.getAttribute('src') !== src) {
    image.hidden = true;
    image.dataset.loaded = '';
    image.src = src;
    return null;
  }
  if (image.dataset.loaded !== src || !image.naturalWidth) return null;
  image.hidden = false;
  image.alt = profile.speaker;
  const active = $('speaker').value === side;
  const geometry = figureGeometry(config, id, { width: image.naturalWidth, height: image.naturalHeight }, side, active);
  Object.assign(image.style, { width: `${geometry.width}px`, height: `${geometry.height}px`, left: `${geometry.x}px`, top: `${geometry.y}px`, filter: active || $('speaker').value === 'none' ? 'none' : 'brightness(.8) saturate(.72) contrast(.92)' });
  return { name: profile.speaker, ...geometry };
}

function render() {
  queued = false;
  if (!config) return;
  for (const [key, value] of Object.entries(presentationVariables(config))) stage.style.setProperty(key, value);
  // CSS transform receives a numeric scale, independent of the page's font size.
  stage.style.transform = `scale(${$('preview-frame').clientWidth / config.stage.width})`;
  const figures = ['left', 'right'].map(renderFigure).filter(Boolean);
  const speakerId = $(`${$('speaker').value}-character`)?.value;
  $('preview-name').textContent = config.characters[speakerId]?.speaker ?? '';
  $('preview-name').hidden = !speakerId;
  stage.style.fontFamily = `"${$('font').value}", serif`;
  const text = $('preview-text');
  text.style.fontSize = `${playerFontSizes[$('player-size').value] * 100}%`;
  const sample = $('sample').value;
  if (text.firstElementChild.textContent !== sample) text.firstElementChild.textContent = sample;
  stage.style.setProperty('--pt-current-box-height', `${textBoxHeight(config, text.firstElementChild.offsetHeight)}px`);
  const warnings = [];
  for (const figure of figures) {
    if (figure.y - figure.height / 2 < 0 || figure.x - figure.width / 2 < 0 || figure.x + figure.width / 2 > config.stage.width) warnings.push(`${figure.name}的画布越过上方或两侧边缘，注意检查裁切。`);
  }
  if (text.scrollHeight > text.clientHeight + 2) warnings.push('这段预览文字超过对话框上限，可滚动阅读；游戏会在构建时拆成更短的阅读页。');
  $('warning').textContent = warnings.join(' ');
  $('layout-info').textContent = `游戏每页最多约 ${pageLimit(config)} 字，优先按标点拆页。当前对话框高 ${stage.style.getPropertyValue('--pt-current-box-height')}（2560 × 1440 舞台坐标）。`;
}

function validateImport(input) {
  const next = normalizePresentation(input);
  if (Object.keys(next.characters).sort().join() !== Object.keys(original.characters).sort().join()) throw new Error('请导入本项目的完整 presentation.json，角色列表不一致');
  for (const [id, profile] of Object.entries(next.characters)) {
    if (typeof profile.speaker !== 'string') throw new Error('角色缺少名字');
    const files = profile.expressions ?? { neutral: `${id}.png` };
    if (!files.neutral || Object.values(files).some(file => !/^[A-Za-z0-9_-]+\.png$/.test(file))) throw new Error('立绘文件名无效');
  }
  if (!next.locations) throw new Error('配置缺少 locations，请导入完整配置');
  return next;
}

async function init() {
  const response = await fetch('./game/presentation.json');
  if (!response.ok) throw new Error('配置载入失败，请先构建游戏并通过 HTTP 打开此页');
  original = normalizePresentation(await response.json());
  config = structuredClone(original);
  selected = config.characters.witch ? 'witch' : Object.keys(config.characters)[0];
  const characters = Object.entries(config.characters).map(([id, profile]) => [id, profile.speaker]);
  fill($('left-character'), [['', '不显示'], ...characters], config.characters.marian ? 'marian' : characters[0][0]);
  fill($('right-character'), [['', '不显示'], ...characters], selected);
  fill($('edit-character'), characters, selected);
  updateExpressions();
  slider($('global-controls'), '全体立绘倍率', [0.6, 1.4, 0.01], () => config.figureScale, value => config.figureScale = value);
  slider($('global-controls'), '左侧中心位置', [300, 1200, 10], () => config.stage.leftX, value => config.stage.leftX = value);
  slider($('global-controls'), '右侧中心位置', [1360, 2260, 10], () => config.stage.rightX, value => config.stage.rightX = value);
  slider($('character-sliders'), '角色倍率', [0.4, 1.5, 0.01], () => config.characters[selected].scale, value => config.characters[selected].scale = value);
  slider($('character-sliders'), '上下偏移（正数向下）', [-200, 400, 5], () => config.characters[selected].y, value => config.characters[selected].y = value);
  for (const [key, range] of Object.entries(textRanges)) slider($('text-controls'), names[key], range, () => config.text[key], value => config.text[key] = value);
  for (const id of ['left-character', 'right-character', 'player-size', 'speaker', 'font']) $(id).addEventListener('change', schedule);
  $('edit-character').addEventListener('change', () => {
    selected = $('edit-character').value;
    // Reveal the edited character so every slider has a visible effect.
    if (![$('left-character').value, $('right-character').value].includes(selected)) $('left-character').value = selected;
    updateExpressions(); sliders.forEach(sync => sync()); schedule();
  });
  $('expression').addEventListener('change', () => { expressions[selected] = $('expression').value; schedule(); });
  $('scene').addEventListener('change', () => {
    $('background').src = `./game/background/${$('scene').value}.svg`;
    $('background').alt = $('scene').selectedOptions[0].textContent;
  });
  $('sample').addEventListener('input', schedule);
  for (const side of ['left', 'right']) {
    const img = $(`figure-${side}`);
    img.addEventListener('load', () => { img.dataset.loaded = img.getAttribute('src'); schedule(); });
    img.addEventListener('error', () => { img.hidden = true; status(`无法载入立绘：${img.getAttribute('src')}。请检查文件名并重新构建。`); });
  }
  $('reset').addEventListener('click', () => {
    config = structuredClone(original);
    for (const id of Object.keys(expressions)) delete expressions[id];
    updateExpressions(); sliders.forEach(sync => sync()); schedule(); status('已恢复本次载入的配置。');
  });
  $('import').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 100000) throw new Error('配置文件过大');
      config = validateImport(JSON.parse(await file.text()));
      for (const id of Object.keys(expressions)) delete expressions[id];
      updateExpressions(); sliders.forEach(sync => sync()); schedule(); status('已导入配置。检查预览后可继续调整或导出。');
    } catch (error) { status(`导入失败：${error.message}`); }
    event.target.value = '';
  });
  $('export').addEventListener('click', () => {
    try {
      const output = JSON.stringify(normalizePresentation(config), null, 2) + '\n';
      const url = URL.createObjectURL(new Blob([output], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'presentation.json'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      status('已导出 presentation.json。替换 game/presentation.json 后重新构建即可应用。');
    } catch (error) { status(`导出失败：${error.message}`); }
  });
  document.querySelectorAll('[disabled]').forEach(element => element.disabled = false);
  new ResizeObserver(schedule).observe($('preview-frame'));
  document.fonts.addEventListener('loadingdone', schedule);
  document.fonts.ready.then(schedule);
  schedule(); status('拖动滑块即可预览；离开前请导出配置。');
}

init().catch(error => status(error.message));
