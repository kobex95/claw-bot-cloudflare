/**
 * Example Skill: Calculator
 * Simple calculator that can evaluate math expressions
 */

export const calculatorSkill = {
  name: 'calculator',
  description: 'Performs basic math calculations',
  version: '1.0.0',
  triggers: ['/calc', '/calculate', 'calculate'],
  handler: async (ctx: any): Promise<string> => {
    const text = ctx.message.text;
    const expr = text.replace(/^(\/calc|\/calculate|calculate)\s*/, '').trim();
    
    if (!expr) {
      return 'Usage: /calc <expression>\nExample: /calc 2 + 2 * 3';
    }
    
    try {
      // Safe evaluation: only allow numbers and basic operators
      if (!/^[0-9+\-*/().\s]+$/.test(expr)) {
        return 'Invalid characters in expression';
      }
      
      // eslint-disable-next-line no-eval
      const result = eval(expr);
      return `Result: ${result}`;
    } catch (error) {
      return `Error: ${(error as Error).message}`;
    }
  },
};
