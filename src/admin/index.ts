/**
 * Admin API Entry Point
 * Handles all /admin/* routes
 */

import { handleDashboard, handleSessions, handleSkills, handleConfig } from './routes';

// Embedded admin UI HTML (Chinese version with explicit login)
const ADMIN_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>管理后台 - claw-bot-cloudflare</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    :root {
      --primary: #6366f1;
      --primary-dark: #4f46e5;
      --bg-color: #f0f2f5;
      --card-bg: #ffffff;
      --text-primary: #1f2937;
      --text-secondary: #6b7280;
      --border-color: #e5e7eb;
      --danger: #ef4444;
      --success: #10b981;
    }
    
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif; 
      background: var(--bg-color); 
      color: var(--text-primary);
      min-height: 100vh;
    }
    
    /* Header */
    header { 
      background: var(--card-bg); 
      padding: 1rem 2rem; 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      position: sticky;
      top: 0;
      z-index: 100;
    }
    
    h1 { font-size: 1.5rem; font-weight: 600; color: var(--primary); }
    
    .btn-link {
      background: none;
      border: none;
      color: var(--primary);
      cursor: pointer;
      font-size: 1rem;
      text-decoration: none;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      transition: background 0.2s;
    }
    
    .btn-link:hover { background: rgba(99, 102, 241, 0.1); }
    
    /* Container */
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    
    /* Login Screen */
    .login-wrapper {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 2rem;
    }
    
    .login-card {
      background: var(--card-bg);
      padding: 2.5rem;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.07), 0 10px 15px rgba(0,0,0,0.05);
      width: 100%;
      max-width: 400px;
    }
    
    .login-card h2 {
      text-align: center;
      margin-bottom: 1.5rem;
      color: var(--text-primary);
      font-size: 1.75rem;
    }
    
    .form-group { margin-bottom: 1.25rem; }
    
    label { 
      display: block; 
      margin-bottom: 0.5rem; 
      font-weight: 500; 
      color: var(--text-secondary);
      font-size: 0.875rem;
    }
    
    input {
      width: 100%;
      padding: 0.75rem;
      border: 2px solid var(--border-color);
      border-radius: 8px;
      font-size: 1rem;
      transition: border-color 0.2s, box-shadow 0.2s;
      outline: none;
    }
    
    input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    }
    
    .btn-primary {
      width: 100%;
      padding: 0.875rem;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
    }
    
    .btn-primary:hover {
      background: var(--primary-dark);
      transform: translateY(-1px);
    }
    
    .btn-primary:active { transform: translateY(0); }
    
    .alert {
      padding: 1rem;
      margin-bottom: 1rem;
      border-radius: 8px;
      font-size: 0.875rem;
    }
    
    .alert-error {
      background: #fef2f2;
      color: #dc2626;
      border: 1px solid #fecaca;
    }
    
    .alert-success {
      background: #d1fae5;
      color: #059669;
      border: 1px solid #a7f3d0;
    }
    
    /* Main App (hidden until login) */
    #app { display: none; }
    
    /* Stats Grid */
    .stats { 
      display: grid; 
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
      gap: 1.5rem; 
      margin-bottom: 2rem; 
    }
    
    .stat-card { 
      background: var(--card-bg); 
      padding: 1.5rem; 
      border-radius: 12px; 
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      border: 1px solid var(--border-color);
    }
    
    .stat-card h3 { 
      font-size: 0.875rem; 
      color: var(--text-secondary); 
      margin-bottom: 0.5rem; 
      font-weight: 500;
    }
    
    .stat-card .value { 
      font-size: 2rem; 
      font-weight: 700; 
      color: var(--text-primary);
    }
    
    /* Sections */
    section { 
      background: var(--card-bg); 
      border-radius: 12px; 
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      border: 1px solid var(--border-color);
      margin-bottom: 2rem; 
      overflow: hidden; 
    }
    
    section h2 { 
      background: #f9fafb; 
      padding: 1rem 1.5rem; 
      font-size: 1.125rem; 
      border-bottom: 1px solid var(--border-color);
      font-weight: 600;
      color: var(--text-primary);
    }
    
    /* Tables */
    table { width: 100%; border-collapse: collapse; }
    
    th, td { 
      padding: 0.875rem 1.5rem; 
      text-align: left; 
      border-bottom: 1px solid var(--border-color);
    }
    
    th { 
      background: #f9fafb; 
      font-weight: 600; 
      color: var(--text-secondary);
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    tr:hover { background: #f9fafb; }
    
    tr:last-child td { border-bottom: none; }
    
    /* Buttons */
    .btn { 
      display: inline-block; 
      padding: 0.5rem 1rem; 
      border: none; 
      border-radius: 6px; 
      cursor: pointer; 
      font-size: 0.875rem; 
      text-decoration: none;
      font-weight: 500;
      transition: all 0.2s;
    }
    
    .btn-danger { background: var(--danger); color: white; }
    .btn-danger:hover { background: #dc2626; }
    
    .btn-sm { padding: 0.375rem 0.75rem; font-size: 0.75rem; }
    
    .btn:disabled { 
      opacity: 0.5; 
      cursor: not-allowed; 
      transform: none !important;
    }
    
    /* Tabs */
    .tabs { 
      display: flex; 
      border-bottom: 1px solid var(--border-color); 
      background: var(--card-bg);
      border-radius: 12px 12px 0 0;
      overflow: hidden;
    }
    
    .tab { 
      padding: 1rem 1.5rem; 
      cursor: pointer; 
      border-bottom: 2px solid transparent; 
      transition: all 0.2s;
      font-weight: 500;
      color: var(--text-secondary);
    }
    
    .tab:hover { background: #f9fafb; }
    
    .tab.active { 
      border-bottom-color: var(--primary); 
      background: #f9fafb; 
      color: var(--primary);
      font-weight: 600;
    }
    
    .tab-content { 
      display: none; 
      padding: 0; 
    }
    
    .tab-content.active { 
      display: block; 
    }
    
    .tab-content > div { padding: 1.5rem; }
    
    /* Code */
    pre { 
      background: #1f2937; 
      color: #f3f4f6; 
      padding: 1rem; 
      border-radius: 8px; 
      overflow-x: auto; 
      font-size: 0.875rem; 
      line-height: 1.6;
    }
    
    code { 
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; 
    }
    
    .code-block {
      background: #1f2937;
      border-radius: 8px;
      overflow: hidden;
    }
    
    .code-block pre {
      margin: 0;
      border-radius: 0;
    }
    
    .code-header {
      background: #111827;
      padding: 0.5rem 1rem;
      font-size: 0.75rem;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    /* Loading */
    .loading { 
      text-align: center; 
      padding: 3rem; 
      color: var(--text-secondary); 
    }
    
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid var(--border-color);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }
    
    @keyframes spin { to { transform: rotate(360deg); } }
    
    /* Empty states */
    .empty-state {
      text-align: center;
      padding: 3rem;
      color: var(--text-secondary);
    }
    
    /* Responsive */
    @media (max-width: 768px) {
      .container { padding: 1rem; }
      .stats { grid-template-columns: repeat(2, 1fr); gap: 1rem; }
      .stat-card { padding: 1rem; }
      .stat-card .value { font-size: 1.5rem; }
      table { display: block; overflow-x: auto; }
    }
  </style>
</head>
<body>
  <!-- Login Screen -->
  <div class="login-wrapper" id="loginScreen">
    <div class="login-card">
      <h2>🔐 管理员登录</h2>
      <div id="loginError" class="alert alert-error" style="display: none;"></div>
      <form id="loginForm" onsubmit="return handleLogin(event)">
        <div class="form-group">
          <label for="username">用户名</label>
          <input type="text" id="username" name="username" required autocomplete="username" placeholder="输入用户名">
        </div>
        <div class="form-group">
          <label for="password">密码</label>
          <input type="password" id="password" name="password" required autocomplete="current-password" placeholder="输入密码">
        </div>
        <button type="submit" class="btn-primary" id="loginBtn">登录</button>
      </form>
    </div>
  </div>
  
  <!-- Main Application -->
  <div id="app">
    <header>
      <h1>🦀 管理后台</h1>
      <div style="display: flex; gap: 10px; align-items: center;">
        <span id="userDisplay" style="color: var(--text-secondary); font-size: 0.875rem;"></span>
        <button class="btn-link" onclick="logout()">退出登录</button>
        <a href="/chat" class="btn-link">← 返回聊天</a>
      </div>
    </header>
    
    <div class="container">
      <div class="tabs">
        <div class="tab active" data-tab="dashboard">数据概览</div>
        <div class="tab" data-tab="sessions">会话管理</div>
        <div class="tab" data-tab="skills">技能管理</div>
        <div class="tab" data-tab="config">配置查看</div>
      </div>
      
      <!-- Dashboard Tab -->
      <div id="dashboard" class="tab-content active">
        <div class="stats" id="stats">
          <div class="loading">
            <div class="spinner"></div>
            <div>加载统计数据...</div>
          </div>
        </div>
      </div>
      
      <!-- Sessions Tab -->
      <div id="sessions" class="tab-content">
        <div class="form-group" style="display: flex; gap: 10px; margin-bottom: 1rem;">
          <input type="text" id="sessionSearch" placeholder="搜索用户 ID 或会话 ID..." style="flex: 1;">
          <button class="btn" onclick="loadSessions()">搜索</button>
          <button class="btn btn-danger" onclick="clearAllSessions()">清空全部</button>
        </div>
        <table id="sessionsTable">
          <thead>
            <tr>
              <th>会话 ID</th>
              <th>用户 ID</th>
              <th>聊天 ID</th>
              <th>消息数</th>
              <th>最后更新</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr><td colspan="6" class="loading">加载会话...</td></tr>
          </tbody>
        </table>
      </div>
      
      <!-- Skills Tab -->
      <div id="skills" class="tab-content">
        <div style="margin-bottom: 1rem; display: flex; gap: 10px;">
          <button class="btn" onclick="reloadSkills()">重新加载</button>
          <button class="btn btn-danger" onclick="clearAllSkills()">清空全部</button>
        </div>
        <table id="skillsTable">
          <thead>
            <tr>
              <th>技能名称</th>
              <th>描述</th>
              <th>版本</th>
              <th>触发词</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr><td colspan="5" class="loading">加载技能...</td></tr>
          </tbody>
        </table>
      </div>
      
      <!-- Config Tab -->
      <div id="config" class="tab-content">
        <div class="code-block">
          <div class="code-header">环境变量配置</div>
          <pre id="configOutput">加载中...</pre>
        </div>
      </div>
    </div>
  </div>
  
  <script>
    const API_BASE = '/admin';
    let authCredentials = null;
    
    // Check if already logged in
    function checkAuth() {
      const stored = sessionStorage.getItem('admin_auth');
      if (stored) {
        try {
          authCredentials = JSON.parse(stored);
          document.getElementById('loginScreen').style.display = 'none';
          document.getElementById('app').style.display = 'block';
          document.getElementById('userDisplay').textContent = '已登录: ' + authCredentials.username;
          return true;
        } catch (e) {
          console.error('[Auth] Failed to parse stored credentials:', e);
          sessionStorage.removeItem('admin_auth');
        }
      }
      return false;
    }
    
    async function handleLogin(e) {
      e.preventDefault();
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      const btn = document.getElementById('loginBtn');
      const errorDiv = document.getElementById('loginError');
      
      btn.disabled = true;
      btn.textContent = '登录中...';
      errorDiv.style.display = 'none';
      
      try {
        // Test credentials by calling dashboard
        const credentials = btoa(username + ':' + password);
        console.log('[Frontend] Sending Authorization: Basic ' + credentials);
        
        const res = await fetch(\`\${API_BASE}/dashboard\`, {
          headers: {
            'Authorization': 'Basic ' + credentials
          }
        });
        
        console.log('[Frontend] Response status:', res.status);
        
        if (res.ok) {
          // Login successful
          authCredentials = { username, credentials };
          sessionStorage.setItem('admin_auth', JSON.stringify(authCredentials));
          document.getElementById('loginScreen').style.display = 'none';
          document.getElementById('app').style.display = 'block';
          document.getElementById('userDisplay').textContent = '已登录: ' + username;
        } else {
          const errorText = await res.text();
          console.log('[Frontend] Error response:', errorText);
          throw new Error('Invalid credentials (HTTP ' + res.status + ')');
        }
      } catch (err) {
        console.error('[Frontend] Login error:', err);
        errorDiv.textContent = '登录失败: ' + err.message;
        errorDiv.style.display = 'block';
      } finally {
        btn.disabled = false;
        btn.textContent = '登录';
      }
      
      return false;
    }
    
    function logout() {
      authCredentials = null;
      sessionStorage.removeItem('admin_auth');
      document.getElementById('loginScreen').style.display = 'flex';
      document.getElementById('app').style.display = 'none';
      document.getElementById('username').value = '';
      document.getElementById('password').value = '';
    }
    
    async function apiFetch(url, options = {}) {
      if (!authCredentials) {
        throw new Error('Not authenticated');
      }
      
      const headers = {
        ...options.headers,
        'Authorization': 'Basic ' + authCredentials.credentials
      };
      
      const res = await fetch(url, { ...options, headers });
      
      if (res.status === 401) {
        logout();
        throw new Error('Session expired');
      }
      
      return res;
    }
    
    async function loadDashboard() {
      try {
        const res = await apiFetch(\`\${API_BASE}/dashboard\`);
        const stats = await res.json();
        document.getElementById('stats').innerHTML = \`
          <div class="stat-card">
            <h3>总会话数</h3>
            <div class="value">\${stats.totalSessions}</div>
          </div>
          <div class="stat-card">
            <h3>活跃会话</h3>
            <div class="value">\${stats.activeSessions}</div>
          </div>
          <div class="stat-card">
            <h3>总消息数</h3>
            <div class="value">\${stats.totalMessages}</div>
          </div>
          <div class="stat-card">
            <h3>已加载技能</h3>
            <div class="value">\${stats.totalSkills}</div>
          </div>
        \`;
      } catch (err) {
        document.getElementById('stats').innerHTML = \`<div class="alert-error">加载统计失败: \${err.message}</div>\`;
      }
    }
    
    async function loadSessions(search = '') {
      const tbody = document.querySelector('#sessionsTable tbody');
      tbody.innerHTML = '<tr><td colspan="6" class="loading">加载会话...</td></tr>';
      
      try {
        const url = search ? \`\${API_BASE}/sessions?search=\${encodeURIComponent(search)}\` : \`\${API_BASE}/sessions\`;
        const res = await apiFetch(url);
        const sessions = await res.json();
        
        if (sessions.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" class="empty-state">暂无会话数据</td></tr>';
          return;
        }
        
        tbody.innerHTML = sessions.map(s => \`
          <tr>
            <td><code>\${s.id}</code></td>
            <td>\${s.userId || '-'}</td>
            <td>\${s.chatId || '-'}</td>
            <td>\${s.messageCount}</td>
            <td>\${new Date(s.updatedAt).toLocaleString('zh-CN')}</td>
            <td>
              <button class="btn btn-danger btn-sm" onclick="deleteSession('\${s.id}')">删除</button>
            </td>
          </tr>
        \`).join('');
      } catch (err) {
        tbody.innerHTML = '<tr><td colspan="6" class="alert-error">加载失败: ' + err.message + '</td></tr>';
      }
    }
    
    async function deleteSession(sessionId) {
      if (!confirm('确定删除此会话吗？')) return;
      
      try {
        const res = await apiFetch(\`\${API_BASE}/sessions/\${sessionId}\`, { method: 'DELETE' });
        if (res.ok) {
          loadSessions();
        } else {
          alert('删除失败');
        }
      } catch (err) {
        alert('删除出错: ' + err.message);
      }
    }
    
    async function clearAllSessions() {
      if (!confirm('确定清空所有会话吗？此操作无法撤销！')) return;
      
      try {
        const res = await apiFetch(\`\${API_BASE}/sessions\`, { method: 'DELETE' });
        if (res.ok) {
          loadSessions();
        }
      } catch (err) {
        alert('清空出错: ' + err.message);
      }
    }
    
    async function loadSkills() {
      const tbody = document.querySelector('#skillsTable tbody');
      tbody.innerHTML = '<tr><td colspan="5" class="loading">加载技能...</td></tr>';
      
      try {
        const res = await apiFetch(\`\${API_BASE}/skills\`);
        const skills = await res.json();
        
        if (skills.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" class="empty-state">暂无加载的技能</td></tr>';
          return;
        }
        
        tbody.innerHTML = skills.map(s => \`
          <tr>
            <td><strong>\${s.name}</strong></td>
            <td>\${s.description || '-'}</td>
            <td>\${s.version || '-'}</td>
            <td>\${s.triggers?.join(', ') || '-'}</td>
            <td>
              <button class="btn btn-danger btn-sm" onclick="deleteSkill('\${s.name}')">移除</button>
            </td>
          </tr>
        \`).join('');
      } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5" class="alert-error">加载失败: ' + err.message + '</td></tr>';
      }
    }
    
    async function deleteSkill(name) {
      if (!confirm(\`确定移除技能 "\${name}"？\`)) return;
      
      try {
        const res = await apiFetch(\`\${API_BASE}/skills\`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        if (res.ok) {
          loadSkills();
        } else {
          alert('移除失败');
        }
      } catch (err) {
        alert('移除出错: ' + err.message);
      }
    }
    
    async function reloadSkills() {
      try {
        const res = await apiFetch(\`\${API_BASE}/skills\`, { method: 'POST' });
        if (res.ok) {
          alert('技能已重新加载');
          loadSkills();
        }
      } catch (err) {
        alert('重新加载失败: ' + err.message);
      }
    }
    
    async function clearAllSkills() {
      if (!confirm('确定移除所有技能？此操作无法撤销！')) return;
      
      try {
        const skillsList = await apiFetch(\`\${API_BASE}/skills\`).then(r => r.json());
        for (const skill of skillsList) {
          await apiFetch(\`\${API_BASE}/skills\`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: skill.name }),
          });
        }
        loadSkills();
      } catch (err) {
        alert('清空失败: ' + err.message);
      }
    }
    
    async function loadConfig() {
      try {
        const res = await apiFetch(\`\${API_BASE}/config\`);
        const config = await res.json();
        document.getElementById('configOutput').innerHTML = 
          '<code>' + JSON.stringify(config, null, 2) + '</code>';
      } catch (err) {
        document.getElementById('configOutput').innerHTML = '加载失败: ' + err.message;
      }
    }
    
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
        
        if (tab.dataset.tab === 'dashboard') loadDashboard();
        if (tab.dataset.tab === 'sessions') loadSessions();
        if (tab.dataset.tab === 'skills') loadSkills();
        if (tab.dataset.tab === 'config') loadConfig();
      });
    });
    
    // Initialize
    if (checkAuth()) {
      // Already logged in
    } else {
      // Show login
      document.getElementById('loginScreen').style.display = 'flex';
      document.getElementById('app').style.display = 'none';
    }
  </script>
</body>
</html>`;

export async function handleAdminRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  
  // Route based on path
  const path = url.pathname.replace(/^\/admin/, '');
  
  try {
    if (path === '' || path === '/') {
      // Serve admin UI with CSP that allows inline scripts (for admin panel)
      return new Response(ADMIN_HTML, {
        headers: { 
          'Content-Type': 'text/html; charset=utf-8',
          // Relaxed CSP for admin panel (needs inline JS for simplicity)
          // Note: This is safe because admin requires authentication
          'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none';"
        },
      });
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
