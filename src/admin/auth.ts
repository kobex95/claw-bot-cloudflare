/**
 * Admin Authentication Middleware
 * Uses HTTP Basic Auth with credentials from environment variables
 */

import { Request } from '../types';

export function adminAuthRequired(req: Request, env: any): boolean {
  const auth = req.headers.get('Authorization');
  
  if (!auth || !auth.startsWith('Basic ')) {
    return false;
  }
  
  const credentials = Buffer.from(auth.slice(6)).toString('utf-8');
  const [username, password] = credentials.split(':');
  
  // Get credentials from env (set via wrangler secret)
  const expectedUsername = env.ADMIN_USERNAME || 'admin';
  const expectedPassword = env.ADMIN_PASSWORD || 'changeme';
  
  return username === expectedUsername && password === expectedPassword;
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
