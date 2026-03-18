/**
 * Admin Authentication Middleware
 * Uses HTTP Basic Auth with credentials from environment variables
 */

import { Request } from '../types';

export function adminAuthRequired(req: Request, env: any): boolean {
  const auth = req.headers.get('Authorization');
  
  if (!auth || !auth.startsWith('Basic ')) {
    console.log('[Auth] Missing or invalid Authorization header');
    return false;
  }
  
  try {
    const base64Credentials = auth.slice(6);
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');
    
    console.log('[Auth] Received credentials:', { username, passwordLength: password?.length });
    console.log('[Auth] Expected:', { username: env.ADMIN_USERNAME, passwordLength: env.ADMIN_PASSWORD?.length });
    
    // Get credentials from env (set via wrangler secret)
    const expectedUsername = env.ADMIN_USERNAME || 'admin';
    const expectedPassword = env.ADMIN_PASSWORD || 'changeme';
    
    const isValid = username === expectedUsername && password === expectedPassword;
    console.log('[Auth] Authentication result:', isValid);
    
    return isValid;
  } catch (error) {
    console.error('[Auth] Error parsing credentials:', error);
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
