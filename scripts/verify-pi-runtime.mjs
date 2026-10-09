import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createAgentSession,DefaultResourceLoader,SessionManager} from '@earendil-works/pi-coding-agent';
const dir=mkdtempSync(join(tmpdir(),'pi-compat-'));
const paths=['bash-only','session-workdir','slash-command-visibility','yeet','settle'].map(n=>resolve('extensions',n,'index.ts'));
try {
for(const tools of [undefined,['bash'],['bash','mcp__fixture__*'],['*'],['read'],[]]) {
 const loader=new DefaultResourceLoader({cwd:dir,agentDir:dir,additionalExtensionPaths:paths,noSkills:true,noPromptTemplates:true,noThemes:true});
 await loader.reload();
 assert.equal(loader.getExtensions().errors.length,0);
 const {session}=await createAgentSession({cwd:dir,agentDir:dir,resourceLoader:loader,sessionManager:SessionManager.inMemory(dir),tools,customTools:[{name:'mcp__fixture__echo',label:'Fixture',description:'Fixture MCP tool',parameters:{type:'object',properties:{}},exposure:'deferred',execute:async()=>({content:[{type:'text',text:'ok'}]})}]});
 await session.bindExtensions({mode:'rpc'});
 const expected=tools && !tools.some(x=>x==='bash'||x==='*')?[]:['bash'];
 assert.deepEqual(session.getActiveToolNames(),expected);
 const runner=session.extensionRunner;
 assert.deepEqual(await runner.emitToolCall({type:'tool_call',toolName:'mcp__fixture__echo',toolCallId:'fixture',input:{}}),{block:true,terminate:true});
 assert.deepEqual(await runner.emitToolCall({type:'tool_call',toolName:'codemode',toolCallId:'fixture',input:{}}),{block:true,terminate:true});
 assert.equal(await runner.emitToolCall({type:'tool_call',toolName:'bash',toolCallId:'fixture',input:{command:'true'}}),undefined);
 session.setActiveToolsByName(['bash','read','mcp__fixture__echo']);
 await runner.emitBeforeAgentStart('smoke',undefined,{cwd:dir,selectedTools:session.getActiveToolNames()});
 assert.deepEqual(session.getActiveToolNames(),expected);
 await runner.emit({type:'session_shutdown',reason:'quit'});
 session.dispose();
 console.log('PASS real extension runtime',JSON.stringify(tools??'defaults'),expected);
}
}finally{rmSync(dir,{recursive:true,force:true});}
