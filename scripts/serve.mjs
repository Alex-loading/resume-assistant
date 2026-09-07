import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('..',import.meta.url)));
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.png':'image/png', '.json':'application/json' };
export function createServer() {
  return http.createServer(async(req,res)=>{
    try {
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      const path=resolve(root,'.'+(pathname==='/'?'/extension/workspace.html':pathname));
      // Only serve public demo and extension resources; never personal backups.
      if(![resolve(root,'extension')+sep,resolve(root,'demo')+sep].some(prefix=>path.startsWith(prefix))){res.writeHead(403).end('Forbidden');return;}
      const data=await readFile(path);res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
    }catch{res.writeHead(404).end('Not found');}
  });
}
if(process.argv[1]===fileURLToPath(import.meta.url))createServer().listen(4173,'127.0.0.1',()=>console.log('资料工作台：http://127.0.0.1:4173/extension/workspace.html\n练习表单：http://127.0.0.1:4173/demo/recruitment.html'));
