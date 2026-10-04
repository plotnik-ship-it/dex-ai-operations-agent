import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
const template=await readFile('.env.example','utf8');
const content=template.replace(/^DEMO_AGENT_TOKEN=.*$/m,'DEMO_AGENT_TOKEN='+randomBytes(32).toString('hex'));
try{await writeFile('.env',content,{flag:'wx',mode:0o600});console.log('Created .env with a random local demo token. Default mode: scripted demo.');}
catch(error){if(error.code!=='EEXIST')throw error;console.log('Existing .env preserved. No settings changed.');}
