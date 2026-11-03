// Local developer tool. Never ship the private key in an extension.
import {generateKeyPairSync} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const [destination,keyId]=process.argv.slice(2);
if(!destination||!/^[A-Za-z0-9._-]{1,128}$/.test(keyId??''))throw Error('Usage: node tools/generate-key.mjs PRIVATE.pem KEY_ID');
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
await mkdir(path.dirname(path.resolve(destination)),{recursive:true});
await writeFile(destination,privateKey.export({type:'pkcs8',format:'pem'}),{flag:'wx',mode:0o600});
await writeFile(`${destination}.public.json`,JSON.stringify({keyId,publicKey:publicKey.export({type:'spki',format:'der'}).subarray(-32).toString('base64')},null,2)+'\n',{flag:'wx'});
console.log('Created Ed25519 key. Keep the PEM private; share only the public record.');
