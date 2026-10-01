import { digest, validateBody, validateSchema } from '@prompt-chien/contracts';
import type { BotDefinition, BotPackage, CatalogEntry } from '@prompt-chien/contracts';
import { compile } from './compiler.js';
export async function freezeBot(bot:BotDefinition,catalog:readonly CatalogEntry[],catalogDigest:string,capabilityDigest:string):Promise<BotPackage> {
  validateSchema('bot-definition',bot);
  const {modules}=validateBody(bot.body,catalog);
  const compiled=compile(bot.brain,modules);
  const canonicalGameplay={schemaVersion:bot.schemaVersion,brainAbiVersion:compiled.brainAbiVersion,compilerDigest:compiled.compilerDigest,catalogDigest,body:{grid:bot.body.grid,modules:modules.map(({catalogId,cell,orientation})=>({catalogId,cell,orientation}))},brain:compiled.normalizedIR};
  return {canonicalGameplay,packageHash:await digest(canonicalGameplay),presentationHash:await digest({name:bot.name,cosmetic:bot.cosmetic}),capabilityDigest};
}
