import ts from 'typescript';
import { readdir, readFile } from 'node:fs/promises';
const allowed={contracts:[],content:['contracts'],brain:['contracts'],engine:['contracts','content','brain'],replay:['contracts'],application:['contracts','replay'],persistence:['application'], 'mcp-adapter':['application','contracts'],renderer:['contracts','replay'],'design-system':[],web:['contracts','renderer','design-system'],api:['application','persistence','mcp-adapter'],cli:['contracts','content','brain','engine','replay']};
const pure=new Set(['contracts','content','brain','engine','replay']);
const graph=new Map(),errors=[];
async function files(path){const out=[];for(const entry of await readdir(path,{withFileTypes:true})){if(['node_modules','dist','dist-types'].includes(entry.name))continue;const p=`${path}/${entry.name}`;if(entry.isDirectory())out.push(...await files(p));else if(/\.(?:ts|tsx)$/.test(p))out.push(p);}return out;}
for(const path of [...await files('packages'),...await files('apps')]){
  const name=path.split('/')[1],text=await readFile(path,'utf8'),ast=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true),dependencies=graph.get(name)??new Set();graph.set(name,dependencies);
  function visit(node){
    if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier))inspect(node.moduleSpecifier.text);
    if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword){const arg=node.arguments[0];if(!arg||!ts.isStringLiteral(arg))errors.push(`${path}: computed dynamic import`);else inspect(arg.text);}
    if(pure.has(name)&&ts.isIdentifier(node)&&['process','require','fetch','Date','eval','Function','setTimeout','setInterval','performance'].includes(node.text))errors.push(`${path}: forbidden runtime ${node.text}`);
    if(pure.has(name)&&ts.isPropertyAccessExpression(node)&&node.expression.getText(ast)==='Math'&&['random','sin','cos','atan2'].includes(node.name.text))errors.push(`${path}: nondeterministic math`);
    if(node.kind===ts.SyntaxKind.AnyKeyword)errors.push(`${path}: explicit any`);
    ts.forEachChild(node,visit);
  }
  function inspect(specifier){
    if(specifier.startsWith('@prompt-chien/')){const target=specifier.slice(14);if(target.includes('/')||!allowed[name]?.includes(target))errors.push(`${path}: forbidden import ${specifier}`);dependencies.add(target);}
    if(specifier.startsWith('.')&&specifier.includes('../'))errors.push(`${path}: cross-internal relative import ${specifier}`);
    if(pure.has(name)&&/^(?:node:|fs$|path$|crypto$|http|https|os$|child_process$|worker_threads$)/.test(specifier))errors.push(`${path}: Node I/O import ${specifier}`);
  }
  visit(ast);
}
function cycle(name,path=[]){if(path.includes(name)){errors.push(`cycle: ${[...path,name].join(' -> ')}`);return;}for(const child of graph.get(name)??[])cycle(child,[...path,name]);}
for(const name of graph.keys())cycle(name);
if(errors.length){console.error([...new Set(errors)].join('\n'));process.exitCode=1;}else console.log('Strict types + package boundaries: passed');
