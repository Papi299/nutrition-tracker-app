import { createServer as tcpServer } from 'node:net';
import { createServer as httpServer } from 'node:http';

const LIMIT=131072;
export const syntheticAddress=value=>typeof value==='string'&&/^[a-z0-9._+-]{1,64}@example\.invalid$/.test(value);

// A receiving-only fixture, never an SMTP relay. No sockets connect out, no
// AUTH/TLS credentials, disk persistence, request logging or public endpoints.
export function startCapture(template) {
 const messages=[];
 tcpServer(socket=>{
  let buffer='',data=false,lines=[],recipient=null,sender=false,size=0;
  socket.setTimeout(10000,()=>socket.destroy());socket.on('error',()=>socket.destroy());
  const reply=text=>socket.write(text+'\r\n');reply('220 fixture ESMTP');
  socket.on('data',chunk=>{
   size+=chunk.length;if(size>LIMIT){socket.destroy();return;}
   buffer+=chunk.toString('utf8');
   while(buffer.includes('\r\n')) {
    const end=buffer.indexOf('\r\n'),line=buffer.slice(0,end);buffer=buffer.slice(end+2);
    if(data) {
     if(line==='.') {
      if(messages.length>=32){reply('452 capture full');socket.end();return;}
      messages.push({recipient,raw:lines.join('\r\n')});
      data=false;lines=[];recipient=null;sender=false;reply('250 captured');
     }else lines.push(line.startsWith('..')?line.slice(1):line);
     continue;
    }
    if(/^(EHLO|HELO) [^\r\n]+$/i.test(line))reply('250 fixture');
    else if(/^MAIL FROM:</i.test(line)) {
     const address=line.match(/^MAIL FROM:<([^>]+)>(?: SIZE=\d+)?$/i)?.[1];
     sender=syntheticAddress(address);recipient=null;reply(sender?'250 sender accepted':'550 synthetic sender only');
    }else if(/^RCPT TO:</i.test(line)) {
     const address=line.match(/^RCPT TO:<([^>]+)>$/i)?.[1];
     if(sender&&syntheticAddress(address)&&recipient===null){recipient=address;reply('250 recipient accepted');}
     else reply('550 synthetic single recipient only');
    }else if(line==='DATA'&&sender&&recipient){data=true;reply('354 end with dot');}
    else if(line==='QUIT'){reply('221 closing');socket.end();}
    else if(line==='RSET'){sender=false;recipient=null;reply('250 reset');}
    else if(line==='NOOP')reply('250 ok');else reply('502 unsupported');
   }
  });
 }).listen(2525,'0.0.0.0');
 httpServer((request,response)=>{
  if(request.method==='GET'&&request.url==='/recovery-template') {
   response.writeHead(200,{'Content-Type':'text/html'});response.end(template);
  }else if(request.method==='GET'&&request.url==='/health'){response.end('ready');}
  else {response.writeHead(404);response.end();}
 }).listen(2527,'0.0.0.0');
 // Mail access is loopback-only inside this independently owned container.
 httpServer(async(request,response)=>{
  if(request.method!=='POST'||request.url!=='/take'){response.writeHead(404);response.end();return;}
  let body='';for await(const chunk of request){body+=chunk;if(body.length>256){response.writeHead(413);response.end();return;}}
  let recipient;try{recipient=JSON.parse(body).recipient;}catch{}
  if(!syntheticAddress(recipient)){response.writeHead(400);response.end();return;}
  const index=messages.findIndex(m=>m.recipient===recipient);
  if(index<0){response.writeHead(404);response.end();return;}
  response.writeHead(200,{'Content-Type':'application/json'});response.end(JSON.stringify(messages.splice(index,1)[0]));
 }).listen(2526,'127.0.0.1');
}

export function recoveryMail(raw,expectedEmail) {
 if(!syntheticAddress(expectedEmail)||typeof raw!=='string'||Buffer.byteLength(raw)>LIMIT)throw Error('N002E2_MAIL_SHAPE');
 let decoded=raw.replace(/=\r?\n/g,'').replace(/=([A-F0-9]{2})/gi,(_,n)=>String.fromCharCode(parseInt(n,16)));
 // The provider's gomail implementation emits quoted-printable HTML for the
 // reviewed template. Refuse unreviewed encodings instead of guessing a link.
 if(!/Content-Transfer-Encoding: quoted-printable/i.test(raw))throw Error('N002E2_MAIL_ENCODING');
 decoded=decoded.replaceAll('&amp;','&');
 const links=[...decoded.matchAll(/href="([^"]+)"/g)].map(m=>m[1]);
 if(links.length!==1)throw Error('N002E2_MAIL_LINK_COUNT');
 const url=new URL(links[0]);
 if(url.origin!=='http://localhost:3000'||!['/en/auth/recover/confirm','/he/auth/recover/confirm'].includes(url.pathname)||
  url.searchParams.get('type')!=='recovery'||url.searchParams.getAll('token_hash').length!==1||
  !/^[a-f0-9]{56}$/.test(url.searchParams.get('token_hash')??''))throw Error('N002E2_MAIL_LINK');
 return {hash:url.searchParams.get('token_hash'),locale:url.pathname.split('/')[1]};
}
