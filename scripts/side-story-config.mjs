import fs from 'node:fs';
import assert from 'node:assert/strict';
import { presentation, figureFile } from './figure-assets.mjs';
import { escapeDialogue } from './story-format.mjs';

export const sideStories = JSON.parse(fs.readFileSync(new URL('../game/side-stories.json', import.meta.url), 'utf8'));
export const sideEvents = [...sideStories.choices, ...sideStories.callbacks];

export function validateSideStories(paragraphs) {
  const ids = new Set(), anchors = new Set(), variables = new Map();
  for (const choice of sideStories.choices) {
    assert(/^pt_[a-z_]+$/.test(choice.variable) && !variables.has(choice.variable), '支线变量无效或重复');
    assert(choice.options.length >= 2 && choice.options.length <= 4, '每处支线需要 2–4 个选项');
    assert(choice.options.filter(option => !option.when).length >= 2, '每处支线至少保留两个无条件选项');
    const values = choice.options.map(option => option.value);
    assert(values.every(Number.isInteger) && new Set(values).size === values.length, '选项值须为不同的整数');
    variables.set(choice.variable, values);
    escapeDialogue(choice.prompt);
    for (const option of choice.options) assert(option.label && !/[:;|\\\n]/.test(option.label), '选项文字包含控制字符');
  }
  for (const event of sideEvents) {
    assert(/^[a-z][a-z0-9-]*$/.test(event.id) && !ids.has(event.id), '支线 ID 无效或重复');
    ids.add(event.id);
    assert(Number.isInteger(event.afterParagraph) && !anchors.has(event.afterParagraph), '支线段落索引无效或重复');
    anchors.add(event.afterParagraph);
    assert(event.quote && paragraphs[event.afterParagraph]?.includes(event.quote), `支线引文不符：${event.id}`);
    assert(event.cast.length <= 2 && new Set(event.cast).size === event.cast.length, '支线至多两人同屏');
    for (const character of event.cast) figureFile(character);
    if (event.background) assert(/^[a-z-]+\.svg$/.test(event.background), '支线背景文件名无效');
    const routes = event.options ?? event.variants;
    const routeIds = new Set();
    for (const route of routes) {
      assert(/^[a-z][a-z0-9-]*$/.test(route.id) && !routeIds.has(route.id), `分支 ID 无效或重复：${event.id}`);
      routeIds.add(route.id);
      if (route.when) {
        assert(variables.get(route.when.variable)?.includes(route.when.equals), '回应引用了不存在的选择');
        const choice = sideStories.choices.find(choice => choice.variable === route.when.variable);
        assert(choice.afterParagraph < event.afterParagraph, '后续回应必须发生在选择之后');
      }
      assert(route.lines.length > 0, '分支内容不能为空');
      for (const line of route.lines) {
        assert(typeof line.text === 'string' && line.text, '支线台词不能为空');
        escapeDialogue(line.text);
        const character = Object.keys(presentation.characters).find(id => presentation.characters[id].speaker === line.speaker);
        assert(line.speaker === '' || event.cast.includes(character), `支线说话人不在场：${line.speaker}`);
        if (line.expression) figureFile(character, line.expression);
      }
    }
  }
}
