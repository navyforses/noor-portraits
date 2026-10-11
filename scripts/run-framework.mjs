import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const [command,...args]=process.argv.slice(2);
if (!['dev','build'].includes(command)) throw Error('Expected dev or build');
const cli=fileURLToPath(new URL('../node_modules/vinext/dist/cli.js',import.meta.url));
const result=spawnSync(process.execPath,[cli,command,...(command==='dev'?['--port','5173']:[]),...args],{stdio:'inherit'});
if(result.error)throw result.error;
process.exit(result.status??1);
