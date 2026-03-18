/**
 * Example Skill: Echo
 * Simply echoes back the user's message
 */

export const echoSkill = {
  name: 'echo',
  description: 'Echoes back the user message',
  version: '1.0.0',
  triggers: ['/echo', 'echo'],
  handler: async (ctx: any): Promise<string> => {
    const text = ctx.message.text;
    const command = text.toLowerCase().startsWith('/echo') 
      ? text.slice(6).trim() 
      : text.slice(5).trim();
    
    return `Echo: ${command}`;
  },
};
