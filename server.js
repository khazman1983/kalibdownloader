'use strict';
const http = require('node:http');
const https = require('node:https');
const dns = require('node:dns').promises;
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const MAX = 50 * 1024 * 1024;
const blocked = new net.BlockList();
for (const [ip, prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.168.0.0',16],['198.18.0.0',15],['224.0.0.0',3]]) blocked.addSubnet(ip,prefix,'ipv4');
function isPublic(address) {
  if (net.isIPv4(address)) return !blocked.check(address,'ipv4');
  // Restrict IPv6 to global unicast; exclude translation and local scopes.
  return /^2[0-9a-f]{3}:/i.test(address) && !/^2001:(?:0:|db8:)/i.test(address);
}
async function fetchPublic(raw, redirects = 0, deadline = Date.now() + 60000, limit = MAX) {
  if (redirects > 5 || Date.now() >= deadline) throw Error('Terlalu banyak pengalihan atau masa tamat.');
  const url = new URL(raw);
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password || (url.port && !['80','443'].includes(url.port))) throw Error('Gunakan URL HTTP/HTTPS awam pada port standard.');
  const hostname = url.hostname.replace(/^\[|\]$/g,'');
  const addresses = net.isIP(hostname) ? [{address:hostname,family:net.isIP(hostname)}] : await dns.lookup(hostname,{all:true});
  if (!addresses.length || addresses.some(a => !isPublic(a.address))) throw Error('Alamat rangkaian dalaman tidak dibenarkan.');
  return new Promise((resolve,reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const req = transport.get(url, {headers:{'User-Agent':'KalibDownloader/1.0','Accept-Encoding':'identity'}, lookup:(_host, options, callback)=> {
      const candidates = options.family ? addresses.filter(a=>a.family===options.family) : addresses;
      if (!candidates.length) return callback(Error('Alamat tidak tersedia.'));
      if(options.all) callback(null,candidates); else callback(null,candidates[0].address,candidates[0].family);
    }}, res => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
        res.resume(); resolve(fetchPublic(new URL(res.headers.location,url).href,redirects+1,deadline,limit)); return;
      }
      if (res.statusCode !== 200) {res.resume();reject(Error(`Sumber memberi HTTP ${res.statusCode}. Log masuk atau kebenaran mungkin diperlukan.`));return;}
      if (Number(res.headers['content-length']) > limit) {res.destroy();reject(Error('Fail terlalu besar.'));return;}
      let size=0;const chunks=[];
      res.on('data', chunk=>{size+=chunk.length;if(size>limit)res.destroy(Error('Fail terlalu besar.'));else chunks.push(chunk);});
      res.on('error',reject);
      res.on('end',()=>resolve({body:Buffer.concat(chunks),url:url.href,type:String(res.headers['content-type']||'application/octet-stream').split(';')[0]}));
    });
    const timer=setTimeout(()=>req.destroy(Error('Permintaan tamat masa.')),Math.max(1,deadline-Date.now()));
    req.on('close',()=>clearTimeout(timer));req.on('error',reject);
  });
}
function scribd(host) {return host==='scribd.com'||host.endsWith('.scribd.com');}
function publicPdfLink(html, base) {
  // Only explicit public PDF links; never assemble document pages or access protected endpoints.
  for (const tag of html.match(/<(?:a|link)\b[^>]*>/gi)||[]) {
    const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i);
    if (href && /\btype\s*=\s*["']application\/pdf["']/i.test(tag)) {
      return new URL(href[1].replace(/&amp;/g,'&'),base).href;
    }
  }
  return null;
}
function sendJson(res, code, data) {res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function createServer() {
  let active=0;
  return http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    const requestUrl=new URL(req.url,'http://localhost');
    if(requestUrl.pathname==='/api/health') {sendJson(res,200,{ok:true});return;}
    if(requestUrl.pathname==='/api/download') {
      if(req.method!=='POST') {sendJson(res,405,{error:'Gunakan POST.'});return;}
      const origin=req.headers.origin;
      if(origin && origin!==`http://${req.headers.host}` && origin!==`https://${req.headers.host}`) {sendJson(res,403,{error:'Origin tidak dibenarkan.'});return;}
      if(active>=3){sendJson(res,429,{error:'Pelayan sibuk. Cuba sebentar lagi.'});return;}
      active++;
      try {
        let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>8192)throw Error('Permintaan terlalu panjang.');}
        const data=JSON.parse(raw);const url=new URL(data.url);
        if(['youtube.com','youtu.be'].some(d=>url.hostname===d||url.hostname.endsWith('.'+d)))throw Error('YouTube belum disokong. Gunakan muat turun rasmi.');
        let file=await fetchPublic(url.href,0,Date.now()+60000,scribd(url.hostname)?4*1024*1024:MAX);
        if(scribd(url.hostname) && file.type!=='application/pdf') {
          const link=publicPdfLink(file.body.toString('utf8'),file.url);
          if(!link) {sendJson(res,422,{error:'Scribd tidak menyediakan pautan PDF awam pada halaman ini. Gunakan butang Download rasmi Scribd dengan akaun dan kebenaran yang diperlukan. Backend ini tidak membuka dokumen terkunci.',official_url:url.href});return;}
          file=await fetchPublic(link);
          if(file.type!=='application/pdf')throw Error('Pautan Scribd tidak memberikan fail PDF awam.');
        }
        if(!file.body.length)throw Error('Fail kosong.');
        const name=path.basename(new URL(file.url).pathname)||'muat-turun';
        res.writeHead(200,{'Content-Type':file.type,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(name)}`,'Content-Length':file.body.length,'Cache-Control':'no-store','X-File-Name':encodeURIComponent(name)});
        res.end(file.body);
      } catch(e){if(!res.headersSent)sendJson(res,400,{error:e instanceof SyntaxError?'Permintaan tidak sah.':e.message});}
      finally{active--;}
      return;
    }
    const files={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/script.js':'script.js'};
    if(!files[requestUrl.pathname]||!['GET','HEAD'].includes(req.method)){sendJson(res,404,{error:'Tidak ditemui.'});return;}
    const file=files[requestUrl.pathname];const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript'};
    res.writeHead(200,{'Content-Type':types[path.extname(file)]});
    if(req.method==='HEAD')res.end();else fs.createReadStream(path.join(__dirname,file)).pipe(res);
  });
}
if(require.main===module)createServer().listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Kalib backend started'));
module.exports={createServer,isPublic,publicPdfLink,fetchPublic};
