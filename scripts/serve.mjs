import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../dist/',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8','.scss':'text/plain; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.wav':'audio/wav','.mp3':'audio/mpeg','.ttf':'font/ttf','.woff':'font/woff','.woff2':'font/woff2','.wasm':'application/wasm'};

export function createGameServer() {
  return http.createServer(async(req,res)=>{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
    let decoded;
    try{decoded=decodeURIComponent((req.url||'/').split('?')[0]);}catch{res.writeHead(400);res.end();return;}
    const file=path.resolve(root,'.'+decoded.replace(/\\/g,'/'),decoded.endsWith('/')?'index.html':'');
    const relative=path.relative(root,file);
    if(relative.startsWith('..')||path.isAbsolute(relative)||relative.split(path.sep).some(p=>p.startsWith('.'))){res.writeHead(403);res.end();return;}
    try {
      const stat=await fs.promises.stat(file);
      if(!stat.isFile()){res.writeHead(404);res.end();return;}
      res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-cache'});
      if(req.method==='HEAD'){res.end();return;}
      const stream=fs.createReadStream(file);stream.on('error',()=>res.destroy());stream.pipe(res);
    } catch {res.writeHead(404);res.end('File not found');}
  });
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if(!fs.existsSync(path.join(root,'index.html'))) {console.error('请先运行 npm run build。');process.exit(1);}
  const server=createGameServer();
  server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'8080 端口已被占用，请先关闭上一次启动的游戏服务。':e.message);process.exitCode=1;});
  server.listen(8080,'127.0.0.1',()=>console.log('PureTime·黄：http://127.0.0.1:8080\n演出调整：http://127.0.0.1:8080/tune.html\n保持此窗口打开。修改源码后重新构建，再刷新浏览器。Ctrl+C 停止。'));
}
