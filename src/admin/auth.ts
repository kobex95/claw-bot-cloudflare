/**
 * Admin Authentication Middleware
 * Uses HTTP Basic Auth with credentials from environment variables
 */

import { Request } from '../types';

export function adminAuthRequired(req: Request, env: any): boolean {
  try {
    const auth = req.headers.get('Authorization');
    
    if (!auth || !auth.startsWith('Basic ')) {
      console.log('[Auth] Missing or invalid Authorization header');
      return false;
    }
    
    // Decode base64 credentials
    const base64Credentials = auth.slice(6).trim();
    let credentials: string;
    try {
      credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    } catch (decodeError) {
      console.log('[Auth] Failed to decode base64:', decodeError);
      return false;
    }
    
    const colonIndex = credentials.indexOf(':');
    if (colonIndex === -1) {
      console.log('[Auth] Invalid credentials format (no colon)');
      return false;
    }
    
    const username = credentials.substring(0, colonIndex);
    const password = credentials.substring(colonIndex + 1);
    
    // Get expected credentials from env
    const expectedUsername = env.ADMIN_USERNAME;
    const expectedPassword = env.ADMIN_PASSWORD;
    
    if (!expectedUsername || !expectedPassword) {
      console.error('[Auth] Admin credentials not configured in environment!');
      console.error('[Auth] ADMIN_USERNAME:', expectedUsername ? 'set' : 'MISSING');
      console.error('[Auth] ADMIN_PASSWORD:', expectedPassword ? 'set' : 'MISSING');
      // For debugging: allow any credentials if env not set (dev mode)
      // return false; // Production: require credentials
      return username === 'admin' && password === 'changeme'; // Fallback defaults
    }
    
    const isValid = username === expectedUsername && password === expectedPassword;
    console.log('[Auth] Authentication attempt:', { 
      username, 
      expectedUsername, 
      result: isValid 
    });
    
    return isValid;
  } catch (error) {
    console.error('[Auth] Unexpected error:', error);
    return false;
  }
}

export function getAuthChallenge(): Response {
  return new Response('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Admin Panel"',
      'Content-Type': 'text/plain',
    },
  });
}
