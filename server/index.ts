import 'dotenv/config';
import { resolve } from 'node:path';
import { createApp } from './app.ts';
const production=process.env.NODE_ENV==='production';
if(production&&(!process.env.MONGODB_URI||!process.env.APP_ORIGIN?.startsWith('https://')))throw new Error('Production needs MONGODB_URI and an HTTPS APP_ORIGIN');
try{
 const {app,close}=await createApp({uri:process.env.MONGODB_URI,dbName:process.env.MONGODB_DB||'cointrack',production,origin:process.env.APP_ORIGIN,staticDir:resolve('dist')});
 const server=app.listen(Number(process.env.PORT||4317),process.env.HOST||'127.0.0.1',()=>console.log(`CoinTrack listening on ${process.env.HOST||'127.0.0.1'}:${process.env.PORT||4317}; MongoDB ${process.env.MONGODB_URI?'connected':'not configured'}`));
 for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>{void close().then(()=>process.exit(0))}));
}catch{console.error('CoinTrack could not start. Check the private Atlas connection, network allowlist and database permissions. Credentials have not been logged.');process.exit(1)}
