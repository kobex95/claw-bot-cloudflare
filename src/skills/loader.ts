/**
 * Skills Loader
 * Loads skills from KV storage
 */

import { Skill, SkillContext } from '../types';

export async function loadSkills(env: any): Promise<Skill[]> {
  const skills: Skill[] = [];
  
  try {
    // Get skill list from KV
    const skillListJson = await env.KV_SKILLS.get('skills-list', 'json');
    const skillList = skillListJson || [];
    
    for (const skillName of skillList) {
      const skillContent = await env.KV_SKILLS.get(`skill:${skillName}`, 'json');
      if (skillContent) {
        skills.push(skillContent as Skill);
      }
    }
  } catch (error) {
    console.error('Failed to load skills:', error);
  }
  
  return skills;
}

export async function loadSkillFromFile(content: string): Promise<Skill> {
  // Parse Markdown skill format
  const lines = content.split('\n');
  const skill: Partial<Skill> = {};
  let inTriggers = false;
  const triggers: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('# ')) {
      skill.name = line.slice(2).trim();
    } else if (line.toLowerCase().startsWith('description:')) {
      skill.description = line.slice(12).trim();
    } else if (line.toLowerCase().startsWith('version:')) {
      skill.version = line.slice(8).trim();
    } else if (line.toLowerCase() === 'triggers:') {
      inTriggers = true;
    } else if (inTriggers) {
      if (line.startsWith('- ')) {
        triggers.push(line.slice(2).trim());
      } else if (line && !line.startsWith('#')) {
        inTriggers = false;
      }
    } else if (line.toLowerCase().startsWith('```') && !inTriggers) {
      // Code block - assume this is the handler
      const codeLines: string[] = [];
      i++; // skip opening fence
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      skill.handler = createHandlerFromCode(codeLines.join('\n'));
      break;
    }
  }
  
  skill.triggers = triggers;
  
  if (!skill.name || !skill.handler) {
    throw new Error('Invalid skill format');
  }
  
  return skill as Skill;
}

function createHandlerFromCode(code: string): Skill['handler'] {
  // Create a function from code string
  // WARNING: eval is dangerous, use only with trusted skills
  // In production, use a sandbox or pre-compiled functions
  
  return async (ctx: SkillContext): Promise<string> => {
    // Create a safe execution context
    const sandbox = {
      message: ctx.message,
      session: ctx.session,
      memory: ctx.memory,
      respond: ctx.respond,
      console: {
        log: (...args: any[]) => console.log('[Skill]', ...args),
        error: (...args: any[]) => console.error('[Skill]', ...args),
      },
    };
    
    // Build function with sandbox globals
    const fnBody = `
      "use strict";
      return async function(skillCtx) {
        ${code}
      }
    `;
    
    try {
      const fn = new Function('skillCtx', fnBody);
      const handler = await fn(sandbox);
      return await handler(sandbox);
    } catch (error) {
      console.error('Skill execution error:', error);
      return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  };
}

export async function storeSkill(env: any, skill: Skill): Promise<void> {
  const skillList = (await env.KV_SKILLS.get('skills-list', 'json')) || [];
  if (!skillList.includes(skill.name)) {
    skillList.push(skill.name);
    await env.KV_SKILLS.put('skills-list', JSON.stringify(skillList));
  }
  
  await env.KV_SKILLS.put(
    `skill:${skill.name}`,
    JSON.stringify(skill)
  );
}
