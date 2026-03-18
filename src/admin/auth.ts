/**
 * Admin Authentication Middleware
 * Uses HTTP Basic Auth with credentials from environment variables
 */

import { Request } from '../types';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';

export function adminAuthRequired(req: Request): boolean {
  const auth = req.headers.get('Authorization');
  
  if (!auth || !auth.startsWith('Basic ')) {
    return false;
  }
  
  const credentials = Buffer.from(auth.slice(6)).toString('utf-8');
  const [username, password] = credentials.split(':');
  
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
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
