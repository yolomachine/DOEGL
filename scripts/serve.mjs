import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const port=Number(process.env.PORT||4178);
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'};
http.createServer(async(req,res)=>{
  try{
    const requestPath=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const qa=requestPath.startsWith('/__qa__/'),serveRoot=qa?fileURLToPath(new URL('../tests/browser/',import.meta.url)):root;
    const file=path.resolve(serveRoot,'.'+(qa?requestPath.slice(7):requestPath==='/'?'/index.html':requestPath));
    if(!file.startsWith(serveRoot)){res.writeHead(403).end();return;}
    const body=await readFile(file);
    res.writeHead(200,{'Content-Type':`${types[path.extname(file)]||'application/octet-stream'}; charset=utf-8`,'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}).end(body);
  }catch{res.writeHead(404).end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}`));
