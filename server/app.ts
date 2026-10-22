import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { MongoClient } from 'mongodb';
import { randomBytes, createHash, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { z } from 'zod';
import { emptyLedger, ledgerSchema, type Ledger } from '../src/model.ts';
const scrypt=promisify(scryptCallback);
const hashToken=(token:string)=>createHash('sha256').update(token).digest('hex');
const credentials=z.object({email:z.string().email().max(254).transform(v=>v.trim().toLowerCase()),password:z.string().min(12,'Use at least 12 characters').max(128),name:z.string().trim().min(1).max(60).optional()});
const userView=(u:{email:string;name:string})=>({email:u.email,name:u.name});
export async function createApp(options:{uri?:string;dbName?:string;production?:boolean;origin?:string;staticDir?:string}={}){
 const app=express();app.disable('x-powered-by');
 app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'",'https://fonts.googleapis.com'],fontSrc:["'self'",'https://fonts.gstatic.com'],imgSrc:["'self'",'data:'],connectSrc:["'self'"],objectSrc:["'none'"],upgradeInsecureRequests:options.production?[]:null}}}));
 app.use(express.json({limit:'2mb'}));app.use(cookieParser());
 let client:MongoClient|undefined;
 if(options.uri){client=new MongoClient(options.uri,{maxPoolSize:10,serverSelectionTimeoutMS:10000});await client.connect();await client.db(options.dbName||'cointrack').command({ping:1})}
 const db=client?.db(options.dbName||'cointrack');
 const users=db?.collection<{_id:string;email:string;name:string;hash:string;salt:string}>('users');
 const sessions=db?.collection<{_id:string;userId:string;expiresAt:Date}>('sessions');
 const ledgers=db?.collection<{_id:string;revision:number;data:Ledger}>('ledgers');
 if(db){await users!.createIndex({email:1},{unique:true});await sessions!.createIndex({expiresAt:1},{expireAfterSeconds:0});}
 app.get('/api/health',async(_req,res)=>{try{if(db)await db.command({ping:1});res.json({ok:true,configured:!!db,storage:db?'mongodb-atlas':'unconfigured'})}catch{res.status(503).json({error:'Database unavailable',configured:true})}});
 app.use('/api',(_req,res,next)=>{res.set('Cache-Control','no-store');if(!db){res.status(503).json({error:'MongoDB Atlas is not configured. Set MONGODB_URI on the server.'});return}next()});
 // Reject cross-origin mutations even when a browser attaches a session cookie.
 app.use('/api',(req,res,next)=>{if(!['GET','HEAD','OPTIONS'].includes(req.method)){const origin=req.get('origin');const allowed=options.origin||`${req.protocol}://${req.get('host')}`;if((origin&&origin!==allowed)||req.get('sec-fetch-site')==='cross-site'){res.status(403).json({error:'Cross-origin request rejected'});return}if(!req.is('application/json')){res.status(415).json({error:'Use application/json'});return}}next()});
 const authLimiter=rateLimit({windowMs:15*60*1000,limit:30,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Too many sign-in attempts. Try again in 15 minutes.'}});
 const cookieOptions={httpOnly:true,secure:!!options.production,sameSite:'lax' as const,path:'/'};
 async function session(res:express.Response,userId:string){const token=randomBytes(32).toString('hex');const expiresAt=new Date(Date.now()+30*86400000);await sessions!.insertOne({_id:hashToken(token),userId,expiresAt});res.cookie('ct_session',token,{...cookieOptions,expires:expiresAt})}
 app.post('/api/auth/register',authLimiter,async(req,res)=>{const parsed=credentials.safeParse(req.body);if(!parsed.success){res.status(400).json({error:parsed.error.issues[0].message});return}const {email,password,name}=parsed.data;const salt=randomBytes(16).toString('hex');const hash=(await scrypt(password,salt,64) as Buffer).toString('hex');const user={_id:randomBytes(16).toString('hex'),email,name:name||'Your workspace',salt,hash};try{await users!.insertOne(user)}catch(e){if((e as {code:number}).code===11000){res.status(409).json({error:'An account already exists with this email'});return}throw e}try{await ledgers!.insertOne({_id:user._id,revision:0,data:emptyLedger(user.name)})}catch(e){await users!.deleteOne({_id:user._id});throw e}await session(res,user._id);res.status(201).json({user:userView(user)})});
 app.post('/api/auth/login',authLimiter,async(req,res)=>{const parsed=credentials.safeParse(req.body);if(!parsed.success){res.status(400).json({error:'Check your email and password (12–128 characters)'});return}const user=await users!.findOne({email:parsed.data.email});const salt=user?.salt||'unregistered-account-dummy-salt';const testHash=await scrypt(parsed.data.password,salt,64) as Buffer;if(!user||!timingSafeEqual(testHash,Buffer.from(user.hash,'hex'))){res.status(401).json({error:'Email or password is incorrect'});return}await session(res,user._id);res.json({user:userView(user)})});
 app.post('/api/auth/logout',async(req,res)=>{if(req.cookies.ct_session)await sessions!.deleteOne({_id:hashToken(req.cookies.ct_session)});res.clearCookie('ct_session',cookieOptions);res.json({ok:true})});
 app.use('/api',async(req,res,next)=>{const token=req.cookies.ct_session;if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token)){res.status(401).json({error:'Sign in to access your workspace'});return}const s=await sessions!.findOne({_id:hashToken(token),expiresAt:{$gt:new Date()}});if(!s){res.status(401).json({error:'Your session has expired. Please sign in again.'});return}res.locals.userId=s.userId;next()});
 app.get('/api/auth/me',async(_req,res)=>{const u=await users!.findOne({_id:res.locals.userId});if(!u){res.status(401).json({error:'Account not found'});return}res.json({user:userView(u)})});
 app.get('/api/ledger',async(_req,res)=>{const l=await ledgers!.findOne({_id:res.locals.userId});if(!l){res.status(404).json({error:'Workspace not found'});return}res.json({revision:l.revision,data:l.data})});
 app.put('/api/ledger',async(req,res)=>{const parsed=z.object({revision:z.number().int().min(0),data:ledgerSchema}).safeParse(req.body);if(!parsed.success){res.status(400).json({error:parsed.error.issues[0].message});return}const result=await ledgers!.updateOne({_id:res.locals.userId,revision:parsed.data.revision},{$set:{data:parsed.data.data},$inc:{revision:1}});if(!result.matchedCount){res.status(409).json({error:'Your workspace changed in another tab. Reload it before saving.'});return}res.json({revision:parsed.data.revision+1})});
 app.use('/api',(_req,res)=>res.status(404).json({error:'Endpoint not found'}));
 if(options.staticDir){app.use(express.static(options.staticDir,{index:'index.html'}));app.get('/{*path}',(_req,res)=>res.sendFile(options.staticDir+'/index.html'))}
 app.use((err:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{const e=err as {status?:number;type?:string};if(e.type==='entity.too.large'){res.status(413).json({error:'Workspace exceeds the 2 MB request limit'});return}if(e.status===400){res.status(400).json({error:'Invalid JSON'});return}console.error('Request failed:',err instanceof Error?err.name:'UnknownError');res.status(500).json({error:'The request could not be completed. Please try again.'})});
 return{app,close:async()=>client?.close()};
}
