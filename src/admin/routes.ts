/**
 * Admin Dashboard Routes
 * Provides statistics and management capabilities
 */

import { Env } from '../types';
import { adminAuthRequired, getAuthChallenge } from './auth';

export interface DashboardStats {
  totalSessions: number;
  activeSessions: number;
  totalMessages: number;
  totalSkills: number;
  uptime: string;
  lastDeployed: string;
}

export async function handleDashboard(req: Request, env: Env): Promise<Response> {
  if (!adminAuthRequired(req, env)) {
    return getAuthChallenge();
  }
  
  // Gather statistics
  const stats = await collectStats(env);
  
  return new Response(JSON.stringify(stats, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function collectStats(env: Env): Promise<DashboardStats> {
  // Count sessions (DO or memory-based estimate)
  let totalSessions = 0;
  try {
    if (env.SESSION_DO) {
      const sessionList = await env.SESSION_DO.list();
      totalSessions = sessionList.length;
    } else {
      // No DO - count from KV if we store session keys there
      const keys = await env.KV_SKILLS.list({ prefix: 'session:' });
      totalSessions = keys.keys.length;
    }
  } catch (error) {
    console.error('Error counting sessions:', error);
    totalSessions = 0;
  }
  
  // Count messages (if we store them)
  let totalMessages = 0;
  try {
    // If we store message counts per session in KV
    const keys = await env.KV_SKILLS.list({ prefix: 'msg-count:' });
    for (const key of keys.keys) {
      const count = await env.KV_SKILLS.get(key.name, 'json');
      if (typeof count === 'number') {
        totalMessages += count;
      }
    }
  } catch (error) {
    console.error('Error counting messages:', error);
  }
  
  // Count skills
  let totalSkills = 0;
  try {
    const skillsList = await env.KV_SKILLS.get('skills-list', 'json');
    totalSkills = (skillsList as string[] | undefined)?.length || 0;
  } catch (error) {
    console.error('Error counting skills:', error);
  }
  
  return {
    totalSessions,
    activeSessions: Math.floor(totalSessions * 0.3), // Estimate
    totalMessages,
    totalSkills,
    uptime: 'N/A', // Would need to track worker start time
    lastDeployed: new Date().toISOString(),
  };
}

export async function handleSessions(req: Request, env: Env): Promise<Response> {
  if (!adminAuthRequired(req, env)) {
    return getAuthChallenge();
  }
  
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const sessionId = pathParts[pathParts.length - 1];
  
  if (req.method === 'GET' && sessionId && sessionId !== 'sessions') {
    // Get specific session
    if (env.SESSION_DO) {
      const sessionDO = env.SESSION_DO.get(sessionId);
      const session = await sessionDO.fetch(new Request('http://session/session'));
      return session;
    } else {
      // Memory mode - sessions not persisted
      return new Response(JSON.stringify({ error: 'Session persistence not available in memory mode' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  if (req.method === 'GET') {
    // List all sessions (limited)
    if (env.SESSION_DO) {
      try {
        const sessionList = await env.SESSION_DO.list();
        const sessions = await Promise.all(
          sessionList.map(async (id) => {
            try {
              const sessionDO = env.SESSION_DO.get(id);
              const res = await sessionDO.fetch(new Request('http://session/session'));
              if (res.ok) {
                const session = await res.json();
                return {
                  id: session.id,
                  userId: session.userId,
                  chatId: session.chatId,
                  messageCount: session.messages?.length || 0,
                  updatedAt: session.updatedAt,
                };
              }
            } catch (e) {
              // Ignore individual session errors
            }
            return null;
          })
        );
        return new Response(JSON.stringify(sessions.filter(Boolean)), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to list sessions' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } else {
      // Memory mode - no persistent sessions
      return new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  if (req.method === 'DELETE') {
    if (sessionId && sessionId !== 'sessions') {
      // Delete specific session
      if (env.SESSION_DO) {
        const sessionDO = env.SESSION_DO.get(sessionId);
        await sessionDO.fetch(new Request('http://session/session', { method: 'DELETE' }));
        return new Response(JSON.stringify({ success: true }));
      } else {
        return new Response(JSON.stringify({ error: 'Cannot delete sessions in memory mode' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } else {
      // Clear all sessions
      if (env.SESSION_DO) {
        const sessionList = await env.SESSION_DO.list();
        for (const id of sessionList) {
          const sessionDO = env.SESSION_DO.get(id);
          await sessionDO.fetch(new Request('http://session/session', { method: 'DELETE' }));
        }
        return new Response(JSON.stringify({ success: true }));
      } else {
        return new Response(JSON.stringify({ error: 'Cannot clear sessions in memory mode' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
  }
  
  return new Response('Method not allowed', { status: 405 });
}

export async function handleSkills(req: Request, env: Env): Promise<Response> {
  if (!adminAuthRequired(req, env)) {
    return getAuthChallenge();
  }
  
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const skillName = pathParts[pathParts.length - 1];
  
  if (req.method === 'GET') {
    // List all skills
    const skillsList = await env.KV_SKILLS.get('skills-list', 'json');
    const skills = (skillsList as any[] | undefined) || [];
    return new Response(JSON.stringify(skills), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  if (req.method === 'POST') {
    // Reload skills from KV
    await loadSkillsFromKV(env);
    return new Response(JSON.stringify({ success: true }));
  }
  
  if (req.method === 'DELETE') {
    // Delete a specific skill or all
    if (skillName && skillName !== 'skills') {
      // Remove single skill
      const skillsList = await env.KV_SKILLS.get('skills-list', 'json');
      const skills = (skillsList as any[] | undefined) || [];
      const filtered = skills.filter(s => s.name !== skillName);
      await env.KV_SKILLS.put('skills-list', JSON.stringify(filtered));
      await env.KV_SKILLS.delete(`skill:${skillName}`);
      return new Response(JSON.stringify({ success: true }));
    } else {
      // Clear all skills
      const skillsList = await env.KV_SKILLS.get('skills-list', 'json');
      const skills = (skillsList as any[] | undefined) || [];
      for (const skill of skills) {
        await env.KV_SKILLS.delete(`skill:${skill.name}`);
      }
      await env.KV_SKILLS.delete('skills-list');
      return new Response(JSON.stringify({ success: true }));
    }
  }
  
  return new Response('Method not allowed', { status: 405 });
}

export async function handleConfig(req: Request, env: Env): Promise<Response> {
  if (!adminAuthRequired(req, env)) {
    return getAuthChallenge();
  }
  
  // Return sanitized config (no secrets)
  const config = {
    vars: {
      LLM_PROVIDER: env.LLM_PROVIDER,
      LLM_MODEL: env.LLM_MODEL,
      LLM_BASE_URL: env.LLM_BASE_URL ? '***' : undefined,
      IFLLOW_API_KEY: env.IFLLOW_API_KEY ? '***' : undefined,
      MODELSCOPE_API_KEY: env.MODELSCOPE_API_KEY ? '***' : undefined,
      ADMIN_USERNAME: env.ADMIN_USERNAME,
      ADMIN_PASSWORD: env.ADMIN_PASSWORD ? '***' : undefined,
    },
    bindings: {
      KV_SKILLS: env.KV_SKILLS ? 'configured' : undefined,
      DB_MEMORY: env.DB_MEMORY ? 'configured' : undefined,
      SESSION_DO: env.SESSION_DO ? 'configured' : undefined,
    },
  };
  
  return new Response(JSON.stringify(config, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// Load skills from KV storage
async function loadSkillsFromKV(env: Env): Promise<void> {
  // This would typically load skill definitions from KV
  // For now, skills are bundled at build time
  console.log('Skills reload requested');
}
