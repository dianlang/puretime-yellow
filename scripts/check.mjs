import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = new URL('../',import.meta.url);
const p = rel => new URL(rel,root);
const read = rel => fs.readFileSync(p(rel),'utf8');
const paragraphs=read('source/original.txt').split(/\n\s*\n/).map(t=>t.trim()).filter(Boolean);
const map=JSON.parse(read('game/scene/source-map.json'));
const visited=new Set();
for(const row of map.dialogue){
  assert(!visited.has(row.paragraph),'原稿段落重复'); visited.add(row.paragraph);
  assert.equal(row.segments.join(''),paragraphs[row.paragraph],`原稿第 ${row.paragraph} 段内容不一致`);
}
assert.equal(visited.size,408);
for(let i=0;i<413;i++) assert(visited.has(i)||[25,106,205,321,381].includes(i),'正文段落缺失');
const folders={changeBg:'background',changeFigure:'figure',bgm:'bgm',playEffect:'vocal',changeScene:'scene'};
let refs=0;
for(const chapter of map.chapters){
  const sceneLines=read(`dist/game/scene/${chapter.file}`).split('\n');
  const expected=map.dialogue.filter(row=>row.scene===chapter.file).flatMap(row=>row.segments.map(t=>`${row.speaker}:${t};`));
  const actual=sceneLines.filter(line=>line.startsWith(':')||/^(魔女|店员小姐|玛丽安|酒保小姐|小花|掠夺者领队|年长的保安|保安团|长老|电台):/.test(line));
  assert.deepEqual(actual,expected,`游戏正文与原稿映射不一致：${chapter.file}`);
  for(const line of sceneLines){
    const match=/^(changeBg|changeFigure|bgm|playEffect|changeScene):([^; ]+)/.exec(line);
    if(match && match[2]!=='none'){
      const rel=`dist/game/${folders[match[1]]}/${match[2]}`;
      assert(fs.existsSync(p(rel)),`素材引用不存在：${rel}`); refs++;
    }
  }
}
const html=read('dist/index.html');
for(const match of html.matchAll(/(?:src|href)="\.\/([^"?#]+)"/g)) assert(fs.existsSync(p('dist/'+match[1])),`首页引用不存在：${match[1]}`);
for(const file of ['road.svg','cafe.svg','store.svg','station.svg','room.svg','stars.svg']) assert(read('game/background/'+file).includes('<svg'));
assert(read('dist/game/scene/05.txt').trim().endsWith('end;'));
assert(!fs.existsSync(p('dist/source')),'原始文件不应进入发布目录');
console.log(`检查通过：408 个正文段落完整保留，6 幕连通，${refs} 处素材引用有效。`);
