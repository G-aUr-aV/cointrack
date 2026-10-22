import { mkdir, writeFile, chmod, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
if(!process.stdin.isTTY){console.error('Run this command in your own interactive terminal. Do not paste credentials into chat.');process.exit(1)}
const dir=join(homedir(),'.config','cointrack');const file=join(dir,'server.env');
try{await stat(file);console.error('A private configuration already exists. Preserve it and edit it privately; this script will not overwrite it.');process.exit(1)}catch(e){if(e.code!=='ENOENT')throw e}
console.log('Configure the cointrack database on your existing MumbaiCluster.');
console.log('Paste the Atlas Node.js SRV URI. Input is hidden and is not logged.');
process.stdout.write('Atlas URI: ');
process.stdin.setRawMode(true);process.stdin.resume();process.stdin.setEncoding('utf8');
const uri=await new Promise(resolve=>{let value='';const onData=chunk=>{for(const char of chunk){if(char==='\u0003'){process.stdin.setRawMode(false);process.stdout.write('\nCancelled.\n');process.exit(1)}if(char==='\r'||char==='\n'){process.stdin.off('data',onData);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');resolve(value);return}if(char==='\u007f'||char==='\b')value=value.slice(0,-1);else if(char>=' ')value+=char}};process.stdin.on('data',onData)});
let valid=false;try{const parsed=new URL(uri);valid=parsed.protocol==='mongodb+srv:'&&parsed.hostname.endsWith('.mongodb.net')&&!!parsed.username&&!!parsed.password&&!/[\r\n]/.test(uri)}catch{}
if(!valid){console.error('The URI was not saved. Use the mongodb+srv URI from Atlas Connect → Drivers, with URL-encoded credentials.');process.exit(1)}
await mkdir(dir,{recursive:true,mode:0o700});await chmod(dir,0o700);
await writeFile(file,`MONGODB_URI=${uri}\nMONGODB_DB=cointrack\nHOST=127.0.0.1\nPORT=4317\nAPP_ORIGIN=http://localhost:4317\nNODE_ENV=development\n`,{mode:0o600,flag:'wx'});
console.log('Saved to the private CoinTrack configuration with mode 0600. No database changes have been made.');
console.log('Allow this server’s egress IP in Atlas, then follow docs/SETUP.md to start and verify the app.');
