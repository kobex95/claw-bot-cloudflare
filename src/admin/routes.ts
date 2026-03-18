/**
 * Admin Dashboard Routes
 * Provides statistics and management capabilities
 */

import { Env } from '../types';
import { adminAuthRequired, getAuthChallenge } from './auth';
import { listSessionsD1, countAllSessionsD1, countAllMessagesD1, deleteSessionD1 } from '../memory/D1Session';

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
  let totalSessions = 0;
  let totalMessages = 0;
  let totalSkills = 0;
  
  // Count sessions from D1
  try {
    totalSessions = await countAllSessionsD1(env);
  } catch (error) {
    console.error('[Stats] Error counting sessions:', error);
  }
  
  // Count messages from D1
  try {
    totalMessages = await countAllMessagesD1(env);
  } catch (error) {
    console.error('[Stats] Error counting messages:', error);
  }
  
  // Count skills from KV
  try {
    const skillsList = await env.KV_SKILLS.get('skills-list', 'json');
    totalSkills = (skillsList as string[] | undefined)?.length || 0;
  } catch (error) {
    console.error('[Stats] Error counting skills:', error);
  }
  
  // Estimate active sessions (sessions updated in last 24h)
  let activeSessions = 0;
  try {
    const result = await env.DB_MEMORY.prepare(
      'SELECT COUNT(*) as count FROM sessions WHERE updated_at > ?'
    ).bind(Date.now() - 24 * 60 * 60 * 1000).first();
    activeSessions = result?.count || 0;
  } catch (error) {
    console.error('[Stats] Error counting active sessions:', error);
    activeSessions = Math.floor(totalSessions * 0.3);
  }
  
  return {
    totalSessions,
    activeSessions,
    totalMessages,
    totalSkills,
    uptime: 'N/A',
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
  
  if (req.method === 'GET') {
    if (sessionId && sessionId !== 'sessions') {
      // Get specific session
      try {
        const { getSessionD1 } = await import('../memory/D1Session');
        const session = await getSessionD1(sessionId, env);
        if (session) {
          return new Response(JSON.stringify(session), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ error: 'Session not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to get session' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    
    // List all sessions
    try {
      const sessions = await listSessionsD1(env);
      return new Response(JSON.stringify(sessions), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  if (req.method === 'DELETE') {
    if (sessionId && sessionId !== 'sessions') {
      // Delete specific session
      try {
        await deleteSessionD1(sessionId, env);
        return new Response(JSON.stringify({ success: true }));
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to delete session' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } else {
      // Clear all sessions
      try {
        await env.DB_MEMORY.prepare('DELETE FROM sessions').run();
        return new Response(JSON.stringify({ success: true }));
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to clear sessions' }), {
          status: 500,
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
  
  if (req.method === 'GET') {
    const skillsList = await env.KV_SKILLS.get('skills-list', 'json');
    const skills = (skillsList as any[] | undefined) || [];
    return new Response(JSON.stringify(skills), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  if (req.method === 'POST') {
    // Reload skills
    console.log('Skills reload requested');
    return new Response(JSON.stringify({ success: true }));
  }
  
  if (req.method === 'DELETE') {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const skillName = pathParts[pathParts.length - 1];
    
    if (skillName && skillName !== 'skills') {
      const skillsList = await env.KV_SKILLS.get('skills-list', 'json');
      const skills = (skillsList as any[] | undefined) || [];
      const filtered = skills.filter(s => s.name !== skillName);
      await env.KV_SKILLS.put('skills-list', JSON.stringify(filtered));
      await env.KV_SKILLS.delete('skill:' + skillName);
      return new Response(JSON.stringify({ success: true }));
    } else {
      const skillsList = await env.KV_SKILLS.get('skills-list', 'json');
      const skills = (skillsList as any[] | undefined) || [];
      for (const skill of skills) {
        await env.KV_SKILLS.delete('skill:' + skill.name);
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
  
  const config = {
    vars: {
      LLM_PROVIDER: env.LLM_PROVIDER,
      LLM_MODEL: env.LLM_MODEL,
      LLM_BASE_URL: env.LLM_BASE_URL ? '***' : undefined,
      OPENAI_API_KEY: env.OPENAI_API_KEY ? '***' : undefined,
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
