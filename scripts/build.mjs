import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { normalizePresentation, presentationVariables } from '../web/presentation-settings.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const version = '4.6.4';
const sha256 = 'f7dbb153c0372044055ad167eeddc7202c5978bf661983328490ecd8d0a391ae';
const cache = path.join(root, '.cache');
const archive = path.join(cache, `WebGAL-${version}-web.zip`);
fs.mkdirSync(cache,{recursive:true});
if (!fs.existsSync(archive)) {
  console.log(`下载官方 WebGAL ${version}…`);
  const partial=archive+'.part';
  try {
    execFileSync('curl',['--location','--fail','--retry','2',`https://github.com/OpenWebGAL/WebGAL/releases/download/${version}/WebGAL-${version}-web.zip`,'--output',partial],{stdio:'inherit'});
    if(createHash('sha256').update(fs.readFileSync(partial)).digest('hex')!==sha256) throw new Error('引擎下载不完整，请重新运行构建。');
    fs.renameSync(partial,archive);
  } finally { fs.rmSync(partial,{force:true}); }
}
const hash = createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
if (hash !== sha256) throw new Error('WebGAL 下载校验失败。请删除 .cache 中的压缩包后重试。');
await import('./convert-story.mjs');
const { enhanceMainScenes } = await import('./enhance-scenes.mjs');
enhanceMainScenes();
const { buildSideStories } = await import('./build-side-stories.mjs');
buildSideStories();
await import('./make-audio.mjs');
// Rebuild generated output cleanly, so removed/replaced figures do not survive.
fs.rmSync('dist',{recursive:true,force:true});
fs.mkdirSync('dist',{recursive:true});
if(process.platform==='win32') {
  // Windows 10/11 ships bsdtar, which reads ZIP without a PowerShell script.
  execFileSync('tar.exe',['-xf',archive,'-C','dist','--exclude=*.gz','assets','game/template','game/animation','webgal-serviceworker.js','webgal-engine.json','index.html'],{stdio:'inherit'});
} else {
  execFileSync('unzip',['-q','-o',archive,'assets/*','game/template/*','game/animation/*','webgal-serviceworker.js','webgal-engine.json','index.html','-x','*.gz','-d','dist']);
}
fs.cpSync('game','dist/game',{recursive:true});
fs.rmSync('dist/game/scene/source-map.json',{force:true});
fs.cpSync('web','dist',{recursive:true});
fs.cpSync('licenses','dist/licenses',{recursive:true});
const presentation = normalizePresentation(JSON.parse(fs.readFileSync('game/presentation.json','utf8')));
fs.writeFileSync('dist/presentation.css', ':root {\n' + Object.entries(presentationVariables(presentation)).map(([key,value]) => `  ${key}: ${value};`).join('\n') + '\n}\n');
// Use the same custom textbox CSS and installed fonts in the author preview.
fs.copyFileSync('game/template/Stage/TextBox/textbox.scss', 'dist/tune-textbox.css');
const engineCss = fs.readdirSync('dist/assets').filter(name => name.endsWith('.css')).map(name => fs.readFileSync(`dist/assets/${name}`,'utf8')).join('\n');
const fontFaces = [...engineCss.matchAll(/@font-face\s*\{[^}]+\}/g)].map(match => match[0].replace(/url\(\s*(["']?)\.\//g, 'url($1./assets/')).join('\n');
fs.writeFileSync('dist/tune-fonts.css', fontFaces);
let html = fs.readFileSync('dist/index.html','utf8');
html = html.replace('<title>WebGAL</title>','<title>PureTime · 黄</title>\n<meta name="description" content="一场穿过无尽黄昏的公路旅行。PureTime·黄，网页视觉小说。">');
html = html.replace(/<link[^>]+(?:icons\/|manifest\.json)[^>]*>/g,'');
html = html.replace('</head>','<link rel="icon" type="image/svg+xml" href="./puretime.svg">\n<link rel="stylesheet" href="./puretime.css">\n<link rel="stylesheet" href="./presentation.css">\n<script defer src="./puretime-ui.js"></script>\n<script type="module" src="./text-layout.js"></script>\n</head>');
html = html.replace('PRESS THE SCREEN TO START','点击屏幕 · 启程');
html = html.replace(/minimum-scale=1, maximum-scale=1, user-scalable=no,?\s*/g,'');
html = html.replace("const live2d2Promise = loadIifePlugin('lib/live2d.min.js');",'const live2d2Promise = Promise.resolve(false);');
html = html.replace("const live2d4Promise = loadIifePlugin('lib/live2dcubismcore.min.js');",'const live2d4Promise = Promise.resolve(false);');
fs.writeFileSync('dist/index.html',html);
await import('./check.mjs');
console.log('构建完成：dist/index.html。通过 HTTP 服务运行，不能直接双击 file:// 打开。');
