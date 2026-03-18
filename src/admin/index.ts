/**
 * Admin API Entry Point
 * Handles all /admin/* routes
 */

import { handleDashboard, handleSessions, handleSkills, handleConfig } from './routes';

export async function handleAdminRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  
  // Route based on path
  const path = url.pathname.replace(/^\/admin/, '');
  
  try {
    if (path === '' || path === '/') {
      // Serve admin UI
      return await fetchAdminUI();
    }
    
    if (path === '/dashboard' || path === '/stats') {
      return handleDashboard(request, env);
    }
    
    if (path.startsWith('/sessions')) {
      return handleSessions(request, env);
    }
    
    if (path.startsWith('/skills')) {
      return handleSkills(request, env);
    }
    
    if (path === '/config') {
      return handleConfig(request, env);
    }
    
    return new Response('Not found', { status: 404 });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function fetchAdminUI(): Promise<Response> {
  // In production with Sites, this would serve from public/admin/
  // For now, return the HTML directly
  const html = `
<!DOCTYPE html>
<html>
<head><title>Admin Panel</title></head>
<body>
  <h1>Admin UI would be served here</h1>
  <p>Configure Sites binding in wrangler.toml to serve static files.</p>
</body>
</html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}
