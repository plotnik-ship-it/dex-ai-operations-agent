import {spawnSync} from 'node:child_process';
if(!process.env.TEST_DATABASE_URL){console.error('TEST_DATABASE_URL is required. Database validation cannot pass by skipping.');process.exit(1);}
const result=spawnSync(process.execPath,['--test','dist/tests/database.test.js'],{stdio:'inherit'});
process.exit(result.status??1);
