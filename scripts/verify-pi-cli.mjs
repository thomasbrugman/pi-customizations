import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'pi-cli-'));
const server=join(dir,'server.mjs');
writeFileSync(server,`import readline from 'node:readline';for await(const line of readline.createInterface({input:process.stdin})){const m=JSON.parse(line);if(m.id===undefined)continue;let result={};if(m.method==='initialize')result={protocolVersion:m.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name:'fixture',version:'1'}};if(m.method==='tools/list')result={tools:[{name:'echo',description:'fixture echo',inputSchema:{type:'object',properties:{}}}]};process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,result})+'\\n');}`);
writeFileSync(join(dir,'mcp.json'),JSON.stringify({mcpServers:{fixture:{command:process.execPath,args:[server],exposure:'direct'}}}));
const probe=join(dir,'probe.ts');
writeFileSync(probe,`export default function(pi){pi.registerCommand('compat',{description:'Probe',handler:async()=>{await new Promise(r=>setTimeout(r,1500));console.log(JSON.stringify({compat:true,active:pi.getActiveTools(),all:pi.getAllTools().map(t=>t.name),commands:pi.getCommands().map(c=>c.name)}));}});}`);
try{for(const launcher of ['node_modules/@earendil-works/pi-coding-agent/dist/cli.js','bin/pi.mjs','bin/pi-coding-agent.mjs']) for(const flags of [[],['--tools','bash'],['--tools','bash,mcp__fixture__*'],['--exclude-tools','mcp__*'],['--no-mcp']]){
const child=spawn(process.execPath,[launcher,'--mode','rpc','--no-session','--extension',probe,...flags],{cwd:process.cwd(),env:{...process.env,PI_CODING_AGENT_DIR:dir},stdio:['pipe','pipe','pipe']});
let out='',err=''; child.stderr.on('data',d=>err+=d);child.stdout.on('data',d=>out+=d);
child.stdin.write(JSON.stringify({id:'probe',type:'prompt',message:'/compat'})+'\n');
const data=await new Promise((res,rej)=>{const timer=setTimeout(()=>{child.kill();rej(Error('timeout '+out+err));},15000);const inspect=()=>{const line=(out+err).split('\n').find(l=>l.includes('"compat":true'));if(line){clearTimeout(timer);res(JSON.parse(line));}};child.stdout.on('data',inspect);child.stderr.on('data',inspect);child.on('exit',()=>{clearTimeout(timer);rej(Error('exited '+out+err));});});
child.kill();await new Promise(r=>child.on('exit',r));
const upstream=launcher.startsWith('node_modules');
if (!upstream) assert.deepEqual(data.active,['bash']);if(!upstream){assert(data.commands.includes('yeet'));assert(data.commands.includes('settle'));}
const mcp=data.all.filter(n=>n.startsWith('mcp__'));
assert.equal(mcp.length,upstream && !flags.includes('--no-mcp') && !flags.includes('--exclude-tools') ? 1 : 0);
assert(!/Failed to load extension|Error loading/.test(err));console.log('PASS CLI',launcher,flags,data.active,mcp);
}}finally{rmSync(dir,{recursive:true,force:true});}
