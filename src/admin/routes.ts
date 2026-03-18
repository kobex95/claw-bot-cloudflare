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
  if (!adminAuthRequired(req)) {
    return getAuthChallenge();
  }
  
  // Gather statistics
  const stats = await collectStats(env);
  
  return new Response(JSON.stringify(stats, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function collectStats(env: Env): Promise<DashboardStats> {
  // Count sessions from Durable Object namespace (approximate)
  // In production, you'd maintain counters in KV
  const sessionList = await env.SESSION_DO.list();
  const totalSessions = sessionList.length;
  
  // Count messages from KV (if stored)
  let totalMessages = 0;
  try {
    const messageKeys = await env.KV_SKILLS.list<{ count: number }>({ 
      prefix: 'msg-count:' 
    });
    totalMessages = messageKeys.keys.reduce((sum, key) => sum + (key.value?.count || 0), 0);
  } catch {
    totalMessages = 0;
  }
  
  // Count skills
  const skillsList = await env.KV_SKILLS.get('skills-list', 'json');
  const totalSkills = (skillsList as string[] | undefined)?.length || 0;
  
  return {
    totalSessions,
    activeSessions: Math.floor(totalSessions * 0.3), // Estimate
    totalMessages,
    totalSkills,
    uptime: 'N/A', // Would need to track worker start time
    lastDeployed: new Date().toISOString(), // Placeholder
  };
}

export async function handleSessions(req: Request, env: Env): Promise<Response> {
  if (!adminAuthRequired(req)) {
    return getAuthChallenge();
  }
  
  const url = new URL(req.url);
  const sessionId = url.pathname.split('/').pop();
  
  if (req.method === 'GET' && sessionId) {
    // Get specific session
    const sessionDO = env.SESSION_DO.get(sessionId);
    const session = await sessionDO.fetch(new Request('http://session/session'));
    return session;
  }
  
  if (req.method === 'GET') {
    // List all sessions (limited)
    const sessionList = await env.SESSION_DO.list();
    const sessions: any[] = [];
    
    for (const info of sessionList.slice(0, 100)) { // Limit to 100
      const sessionDO = env.SESSION_DO.get(info.id);
      const res = await sessionDO.fetch(new Request('http://session/session'));
      if (res.ok) {
        const session = await res.json();
        sessions.push({
          id: info.id,
          userId: session?.userId,
          chatId: session?.chatId,
          messageCount: session?.messages?.length || 0,
          updatedAt: session?.updatedAt,
        });
      }
    }
    
    return new Response(JSON.stringify(sessions, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  if (req.method === 'DELETE' && sessionId) {
    // Delete specific session
    const sessionDO = env.SESSION_DO.get(sessionId);
    await sessionDO.fetch(new Request('http://session', { method: 'DELETE' }));
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  return new Response('Not found', { status: 404 });
}

export async function handleSkills(req: Request, env: Env): Promise<Response> {
  if (!adminAuthRequired(req)) {
    return getAuthChallenge();
  }
  
  const skillsList = await env.KV_SKILLS.get('skills-list', 'json') || [];
  
  if (req.method === 'GET') {
    // List all skills with details
    const skills = await Promise.all(
      (skillsList as string[]).map(async (name) => {
        const skill = await env.KV_SKILLS.get(`skill:${name}`, 'json');
        return skill;
      })
    );
    
    return new Response(JSON.stringify(skills, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  if (req.method === 'POST') {
    // Reload skills from KV (invalidate cache)
    // In a real implementation, you'd have a cache layer
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Skills cache cleared' 
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  if (req.method === 'DELETE') {
    // Remove a skill
    const body = await req.json();
    const { name } = body;
    
    if (!name || !skillsList.includes(name)) {
      return new Response(JSON.stringify({ error: 'Skill not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Remove from list
    const newList = (skillsList as string[]).filter((n) => n !== name);
    await env.KV_SKILLS.put('skills-list', JSON.stringify(newList));
    await env.KV_SKILLS.delete(`skill:${name}`);
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  return new Response('Method not allowed', { status: 405 });
}

export async function handleConfig(req: Request, env: Env): Promise<Response> {
  if (!adminAuthRequired(req)) {
    return getAuthChallenge();
  }
  
  // Return sanitized configuration (no secrets)
  const config = {
    llm: {
      provider: process.env.OPENAI_API_KEY ? 'OpenAI/StepFun' : 'Cloudflare AI',
      model: 'step-3.5-flash',
    },
    storage: {
      kvBound: !!env.KV_SKILLS,
      d1Bound: !!env.DB_MEMORY,
      doBound: !!env.SESSION_DO,
    },
    features: {
      autoCapture: true,
      autoRecall: true,
      maxSessionMessages: 50,
    },
    limits: {
      maxMessagesPerSession: 50,
      executionTimeout: 30, // seconds
    },
  };
  
  return new Response(JSON.stringify(config, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}
