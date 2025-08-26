// Cloudflare Worker for D1 Database API
export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // 處理 CORS 預檢請求
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // 只處理 API 路由
      switch (path) {
        case '/api/schedules':
          return await handleSchedules(request, env, corsHeaders);
        case '/api/users':
          return await handleUsers(request, env, corsHeaders);
        case '/api/departments':
          return await handleDepartments(request, env, corsHeaders);
        default:
          // 對於非 API 路由，讓 Cloudflare Pages 處理靜態檔案
          return env.ASSETS.fetch(request);
      }
    } catch (error) {
      console.error('API Error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

// 處理行程資料
async function handleSchedules(request, env, corsHeaders) {
  const { method } = request;

  switch (method) {
    case 'GET':
      return await getSchedules(env, corsHeaders);
    case 'POST':
      return await addSchedule(request, env, corsHeaders);
    case 'DELETE':
      return await deleteSchedule(request, env, corsHeaders);
    default:
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }
}

// 獲取所有行程
async function getSchedules(env, corsHeaders) {
  const { results } = await env.DB.prepare(`
    SELECT s.*, u.nickname as added_by_name 
    FROM schedules s 
    LEFT JOIN users u ON s.added_by = u.nickname 
    ORDER BY s.date DESC, s.department, s.staff_name
  `).all();

  // 將資料轉換為前端需要的格式
  const schedules = {};
  results.forEach(row => {
    const { date, department, staff_name, status, added_by_name } = row;
    if (!schedules[date]) schedules[date] = {};
    if (!schedules[date][department]) schedules[date][department] = {};
    schedules[date][department][staff_name] = {
      status,
      addedBy: added_by_name || '未知',
      addedAt: row.added_at
    };
  });

  return new Response(JSON.stringify(schedules), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// 新增行程
async function addSchedule(request, env, corsHeaders) {
  const { date, department, staff_name, status, added_by } = await request.json();

  // 檢查使用者是否存在，不存在則新增
  await env.DB.prepare(`
    INSERT OR IGNORE INTO users (nickname) VALUES (?)
  `).bind(added_by).run();

  // 新增行程
  const result = await env.DB.prepare(`
    INSERT OR REPLACE INTO schedules (date, department, staff_name, status, added_by)
    VALUES (?, ?, ?, ?, ?)
  `).bind(date, department, staff_name, status, added_by).run();

  return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// 刪除行程
async function deleteSchedule(request, env, corsHeaders) {
  const { date, department, staff_name, added_by } = await request.json();

  const result = await env.DB.prepare(`
    DELETE FROM schedules 
    WHERE date = ? AND department = ? AND staff_name = ? AND added_by = ?
  `).bind(date, department, staff_name, added_by).run();

  return new Response(JSON.stringify({ success: true, deleted: result.meta.changes > 0 }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// 處理使用者資料
async function handleUsers(request, env, corsHeaders) {
  const { method } = request;

  switch (method) {
    case 'GET':
      return await getUsers(env, corsHeaders);
    case 'POST':
      return await addUser(request, env, corsHeaders);
    default:
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }
}

// 獲取所有使用者
async function getUsers(env, corsHeaders) {
  const { results } = await env.DB.prepare(`
    SELECT * FROM users ORDER BY created_at DESC
  `).all();

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// 新增使用者
async function addUser(request, env, corsHeaders) {
  const { nickname } = await request.json();

  const result = await env.DB.prepare(`
    INSERT OR IGNORE INTO users (nickname) VALUES (?)
  `).bind(nickname).run();

  return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// 處理部門資料
async function handleDepartments(request, env, corsHeaders) {
  const { method } = request;

  switch (method) {
    case 'GET':
      return await getDepartments(env, corsHeaders);
    default:
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }
}

// 獲取所有部門
async function getDepartments(env, corsHeaders) {
  const { results } = await env.DB.prepare(`
    SELECT * FROM departments ORDER BY display_order
  `).all();

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
