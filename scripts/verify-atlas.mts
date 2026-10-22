import { config } from 'dotenv';
import { MongoClient } from 'mongodb';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { emptyLedger } from '../src/model.ts';
config({path:process.env.COINTRACK_ENV_FILE||join(homedir(),'.config','cointrack','server.env'),quiet:true});
const client=new MongoClient(process.env.MONGODB_URI!,{maxPoolSize:2,serverSelectionTimeoutMS:15000});
let stage='connection';
try{
 await client.connect();const db=client.db('cointrack');await db.command({ping:1});
 stage='collections';const collections=await db.listCollections({},{nameOnly:true}).toArray();assert.deepEqual(collections.map(c=>c.name).sort(),['ledgers','sessions','users']);
 stage='indexes';const users=await db.collection('users').listIndexes().toArray();const sessions=await db.collection('sessions').listIndexes().toArray();
 assert.ok(users.some(i=>i.key.email===1&&i.unique===true));assert.ok(sessions.some(i=>i.key.expiresAt===1&&i.expireAfterSeconds===0));
 stage='transaction';const key='setup-verification-'+randomUUID();const session=client.startSession();let roundtrip=false;
 try{session.startTransaction();await db.collection('ledgers').insertOne({_id:key as never,revision:0,data:emptyLedger('Setup verification')},{session});const loaded=await db.collection('ledgers').findOne({_id:key as never},{session});assert.equal(loaded?.revision,0);await db.collection('ledgers').updateOne({_id:key as never},{$inc:{revision:1}},{session});assert.equal((await db.collection('ledgers').findOne({_id:key as never},{session}))?.revision,1);roundtrip=true;}finally{if(session.inTransaction())await session.abortTransaction();await session.endSession()}
 assert.equal(await db.collection('ledgers').countDocuments({_id:key as never}),0);
 stage='database-isolation';const status=await client.db('admin').command({connectionStatus:1,showPrivileges:true});const roles=status.authInfo?.authenticatedUserRoles||[];const isolation=roles.length===1&&roles[0].role==='readWrite'&&roles[0].db==='cointrack';assert.ok(isolation);
 stage='app-health';let health:Response|undefined;for(let attempt=0;attempt<20;attempt++){try{health=await fetch('http://127.0.0.1:4317/api/health');break}catch(e){if(attempt===19)throw e;await new Promise(resolve=>setTimeout(resolve,250))}}if(!health)throw new Error('App did not become ready');const h=await health.json() as {configured:boolean};assert.equal(h.configured,true);assert.equal((await fetch('http://127.0.0.1:4317/api/ledger')).status,401);
 console.log(JSON.stringify({atlasPing:true,collections:collections.map(c=>c.name).sort(),emailUniqueIndex:true,sessionTTLSeconds:0,transactionalWriteReadUpdate:roundtrip,verificationWriteRolledBack:true,appRoleRestrictedToCointrack:isolation,appHealth:health.status,appAtlasConfigured:true,signedOutLedgerStatus:401}));
}catch(e){console.error(JSON.stringify({verified:false,stage,errorName:e instanceof Error?e.name:'UnknownError',code:(e as {code?:number}).code}));process.exitCode=1}finally{await client.close()}
