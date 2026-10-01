import { readFileSync } from 'node:fs';
import type { BotDefinition, BrainSource, Expr, InlineRule } from '../packages/contracts/dist/index.js';
import { parseBot } from '../packages/contracts/dist/index.js';
export const sample = ():BotDefinition => parseBot(readFileSync('Docs/examples/mantis.bot.json','utf8'));
export const c=(value:number):Expr=>({kind:'const',value});
export const b=(value:boolean):Expr=>({kind:'bool',value});
export const drive=(forward:Expr=c(0)):InlineRule['intent']=>({thrust:{forward,strafe:c(0)},turn:c(0),modules:[]});
export const brain=(when:Expr=b(true),forward:Expr=c(0)):BrainSource=>({abiVersion:'2.0',initialState:'idle',variables:[],skills:[],states:[{id:'idle',rules:[{id:'first',when,intent:drive(forward)}]}]});
