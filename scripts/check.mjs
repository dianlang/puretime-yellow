import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { presentation, figureAssets, figureFile } from './figure-assets.mjs';

const root = new URL('../',import.meta.url);
const p = rel => new URL(rel,root);
const read = rel => fs.readFileSync(p(rel),'utf8');
const paragraphs=read('source/original.txt').split(/\n\s*\n/).map(t=>t.trim()).filter(Boolean);
const map=JSON.parse(read('game/scene/source-map.json'));
const cues = JSON.parse(read('game/expressions.json')).cues;
let expressionState = {}, lastScene = '', lastLocation = '';
const visited=new Set();
for(const row of map.dialogue){
  if(row.scene!==lastScene || row.location!==lastLocation) expressionState={};
  lastScene=row.scene; lastLocation=row.location;
  for(const cue of cues.filter(cue=>cue.paragraph===row.paragraph)) expressionState[cue.character]=cue.expression;
  assert(!visited.has(row.paragraph),'原稿段落重复'); visited.add(row.paragraph);
  assert.equal(row.segments.join(''),paragraphs[row.paragraph],`原稿第 ${row.paragraph} 段内容不一致`);
  assert(row.figures.length<=2,'同时出场超过两人');
  for(const figure of row.figures) assert(presentation.locations[row.location].cast.includes(figure),`角色误入场景：${figure} / ${row.location}`);
  assert.deepEqual(row.expressions,Object.fromEntries(row.figures.map(figure=>[figure,expressionState[figure]??'neutral'])),`表情状态错位：${row.paragraph}`);
}
assert.equal(visited.size,408);
for(let i=0;i<413;i++) assert(visited.has(i)||[25,106,205,321,381].includes(i),'正文段落缺失');
const folders={changeBg:'background',changeFigure:'figure',bgm:'bgm',playEffect:'vocal',changeScene:'scene'};
let refs=0;
const usedExpressions = new Set();
let expressionChanges = 0;
const cropWarnings = new Set();
for(const chapter of map.chapters){
  const sceneLines=read(`dist/game/scene/${chapter.file}`).split('\n');
  const pages=map.dialogue.filter(row=>row.scene===chapter.file).flatMap(row=>row.segments.map(text=>({...row,text})));
  const expected=pages.map(row=>`${row.speaker}:${row.text};`);
  const actual=sceneLines.filter(line=>line.startsWith(':')||/^(魔女|店员小姐|玛丽安|酒保小姐|小花|掠夺者领队|年长的保安|保安团|长老|电台):/.test(line));
  assert.deepEqual(actual,expected,`游戏正文与原稿映射不一致：${chapter.file}`);
  const images={left:null,right:null}, transforms={};
  let page=0, previousLine='';
  for(const line of sceneLines){
    const figureChange=/^changeFigure:([^;\s]+)/.exec(line);
    if(figureChange){
      const side=line.includes(' -left')?'left':line.includes(' -right')?'right':null;
      if(side){
        const file=figureChange[1]==='none'?null:figureChange[1];
        const before=figureAssets.get(images[side]), after=figureAssets.get(file);
        if(file){
          assert(after,`立绘身份未配置：${file}`);
          assert(line.endsWith(' -next;'),'换表情或入场不应要求额外点击');
          usedExpressions.add(`${after.character}/${after.expression}`);
        }
        if(before && after && before.character===after.character && images[side]!==file){
          assert(line.includes(' -duration=0 ') && line.includes(' -enterDuration=0 '),'表情切换不应重新播放入场动画');
          assert(previousLine.startsWith(`changeFigure:${images[side]} -${side} `) && previousLine.includes(' -exitDuration=0 '),'须先清除旧表情的淡出，避免双脸叠影');
          expressionChanges++;
        }
        images[side]=file;
        if(!file) delete transforms[side];
        const match=/-transform=([^ ]+)/.exec(line);
        if(match) transforms[side]=JSON.parse(match[1]);
      }
    }
    if(line.startsWith('setTransform:')){
      const match=/^setTransform:([^ ]+) -target=fig-(left|right)/.exec(line);
      if(match) transforms[match[2]]={...transforms[match[2]],...JSON.parse(match[1])};
    }
    if (/^changeFigure:(?!none(?:\s|;))[^;]*-transform=/.test(line)) {
      assert(line.endsWith(' -next;'),'立绘入场不应要求额外点击');
      const transform=JSON.parse(/-transform=([^ ]+)/.exec(line)[1]);
      const figure=/^changeFigure:([^.;]+)/.exec(line)[1];
      const character=figureAssets.get(`${figure}.png`).character;
      const png=fs.readFileSync(p(`game/figure/${figure}.png`));
      const w=png.readUInt32BE(16),h=png.readUInt32BE(20);
      const fit=Math.min(2560/w,1440/h), anchor=line.includes(' -left')?w*fit/2:2560-w*fit/2;
      const center=anchor+transform.position.x;
      const targetCenter = line.includes(' -left') ? presentation.stage.leftX : presentation.stage.rightX;
      assert(Math.abs(center-targetCenter)<0.001,`立绘未应用配置的位置：${figure}`);
      const focusedScale=presentation.characters[character].scale*presentation.figureScale*1.025;
      if(center-w*fit*focusedScale/2<0 || center+w*fit*focusedScale/2>2560 ||
        720+transform.position.y-h*fit*focusedScale/2<0) cropWarnings.add(character);
    }
    if(line.startsWith(':')||/^(魔女|店员小姐|玛丽安|酒保小姐|小花|掠夺者领队|年长的保安|保安团|长老|电台):/.test(line)){
      const row=pages[page++];
      const visible=Object.values(images).filter(Boolean).map(file=>figureAssets.get(file).character);
      assert.deepEqual([...visible].sort(),[...row.figures].sort(),`实际出场人物不符：${row.paragraph}`);
      const speaking=visible.find(character=>presentation.characters[character].speaker===row.speaker);
      for(const [side,file] of Object.entries(images)){
        if(!file) continue;
        const {character}=figureAssets.get(file), state=transforms[side];
        assert.equal(file,figureFile(character,row.expressions[character]),`实际表情不符：${row.paragraph}`);
        assert.equal(state.alpha,1,'表情切换后人物不应透明');
        assert.equal(state.brightness,!speaking||speaking===character?1:0.8,`换表情后说话人聚焦错误：${row.paragraph}`);
        const scale=Number((presentation.characters[character].scale*presentation.figureScale*(speaking===character?1.025:1)).toFixed(4));
        assert.equal(state.scale.x,scale,`换表情后角色缩放错误：${row.paragraph}`);
        assert.equal(state.scale.y,scale,`换表情后角色缩放错误：${row.paragraph}`);
      }
    }
    const match=/^(changeBg|changeFigure|bgm|playEffect|changeScene):([^; ]+)/.exec(line);
    if(match && match[2]!=='none'){
      const rel=`dist/game/${folders[match[1]]}/${match[2]}`;
      assert(fs.existsSync(p(rel)),`素材引用不存在：${rel}`); refs++;
    }
    previousLine=line;
  }
}
const html=read('dist/index.html');
for(const match of html.matchAll(/(?:src|href)="\.\/([^"?#]+)"/g)) assert(fs.existsSync(p('dist/'+match[1])),`首页引用不存在：${match[1]}`);
for(const file of ['road.svg','cafe.svg','store.svg','station.svg','room.svg','stars.svg']) assert(read('game/background/'+file).includes('<svg'));
assert(read('dist/game/scene/05.txt').trim().endsWith('end;'));
assert(!fs.existsSync(p('dist/source')),'原始文件不应进入发布目录');
for(const cue of cues) assert(usedExpressions.has(`${cue.character}/${cue.expression}`),`表情未接入：${cue.expression}`);
console.log(`检查通过：408 个正文段落完整保留，6 幕连通，${refs} 处素材引用有效，${expressionChanges} 次原位表情切换及说话人聚焦正确。`);
if(cropWarnings.size) console.warn(`构图提示：${[...cropWarnings].join('、')} 的放大画布越过舞台边缘，请在 tune.html 检查是否为预期裁切。`);
await import('./check-branches.mjs');
await import('./check-presentation.mjs');
