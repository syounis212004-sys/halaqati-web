import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
});

const uniq = <T>(rows: T[]) => [...new Set(rows.filter(Boolean))];
const chunk = <T>(arr: T[], n = 200) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

let cachedGoogleToken = '';
let cachedGoogleTokenExp = 0;

function base64Url(input: Uint8Array | string) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function pemPkcs8ToBytes(pem: string) {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const raw = atob(body);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

async function firebaseAccessToken() {
  const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON') || '';
  if (!raw) return null;
  if (cachedGoogleToken && Date.now() < cachedGoogleTokenExp - 60_000) return cachedGoogleToken;
  const svc = JSON.parse(raw);
  if (!svc.client_email || !svc.private_key || !svc.project_id) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is incomplete');
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64Url(JSON.stringify({
    iss: svc.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const signingInput = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    'pkcs8', pemPkcs8ToBytes(String(svc.private_key).replace(/\\n/g, '\n')),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  );
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput)));
  const assertion = `${signingInput}.${base64Url(signature)}`;
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const data = await resp.json();
  if (!resp.ok || !data.access_token) throw new Error(`Firebase OAuth failed: ${data.error_description || data.error || resp.status}`);
  cachedGoogleToken = data.access_token;
  cachedGoogleTokenExp = Date.now() + Number(data.expires_in || 3600) * 1000;
  return cachedGoogleToken;
}

async function sendFcm(token: string, title: string, body: string, data: Record<string, unknown>) {
  const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON') || '';
  if (!raw) return { ok: false, skipped: true, error: 'Firebase is not configured' };
  const svc = JSON.parse(raw);
  const access = await firebaseAccessToken();
  const payloadData: Record<string, string> = {};
  for (const [k, v] of Object.entries(data || {})) {
    if (v === null || v === undefined) continue;
    payloadData[k] = typeof v === 'string' ? v : JSON.stringify(v);
  }
  const resp = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(svc.project_id)}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data: payloadData,
        android: {
          priority: 'high',
          notification: { channel_id: 'halaqati_general', sound: 'default' },
        },
      },
    }),
  });
  const result = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const code = result?.error?.details?.find?.((x: any) => x?.errorCode)?.errorCode || result?.error?.status || '';
    return { ok: false, error: result?.error?.message || `FCM ${resp.status}`, invalid: code === 'UNREGISTERED' || code === 'INVALID_ARGUMENT' };
  }
  return { ok: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return json({ error: 'Unauthorized' }, 401);

    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return json({ error: 'Unauthorized' }, 401);
    const callerId = authData.user.id;
    const { data: caller, error: callerError } = await admin.from('profiles').select('id,role,active,approval_status,full_name').eq('id', callerId).single();
    if (callerError || !caller || !caller.active || caller.approval_status !== 'approved') return json({ error: 'Account is not approved or active' }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '');

    async function isSupervisorFor(halaqaId: string) {
      if (caller.role === 'admin') return true;
      if (caller.role !== 'supervisor') return false;
      const [rel, hq] = await Promise.all([
        admin.from('halaqa_supervisors').select('halaqa_id').eq('halaqa_id', halaqaId).eq('supervisor_id', callerId).maybeSingle(),
        admin.from('halaqas').select('id').eq('id', halaqaId).eq('supervisor_id', callerId).maybeSingle(),
      ]);
      return !!rel.data || !!hq.data;
    }

    async function canWriteStudentEvent(halaqaId: string) {
      if (caller.role === 'admin') return true;
      if (caller.role === 'supervisor') return await isSupervisorFor(halaqaId);
      if (caller.role === 'teacher') {
        const { data } = await admin.from('halaqa_teachers').select('halaqa_id').eq('halaqa_id', halaqaId).eq('teacher_id', callerId).maybeSingle();
        return !!data;
      }
      return false;
    }

    async function guardiansForStudents(studentIds: string[]) {
      const ids = uniq(studentIds);
      if (!ids.length) return [] as string[];
      const out: string[] = [];
      for (const group of chunk(ids, 200)) {
        const { data, error } = await admin.from('student_guardians').select('guardian_id').in('student_id', group);
        if (error) throw error;
        out.push(...(data || []).map((x: any) => x.guardian_id));
      }
      return uniq(out);
    }

    async function activeProfileIds(ids: string[]) {
      const unique = uniq(ids);
      if (!unique.length) return [] as string[];
      const out: string[] = [];
      for (const group of chunk(unique, 200)) {
        const { data, error } = await admin.from('profiles').select('id').in('id', group).eq('active', true).eq('approval_status', 'approved');
        if (error) throw error;
        out.push(...(data || []).map((x: any) => x.id));
      }
      return uniq(out);
    }

    async function studentIdsForScope(scope: string, targetId: string | null) {
      let q = admin.from('students').select('id,halaqa_id').neq('status', 'withdrawn');
      if (scope === 'student') q = q.eq('id', targetId);
      if (scope === 'category') q = q.eq('category_id', targetId);
      if (scope === 'halaqa') q = q.eq('halaqa_id', targetId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    }

    async function recipientsForManual(scope: string, targetId: string | null, audience = 'guardians') {
      if (!['admin', 'supervisor'].includes(caller.role)) throw new Error('Manual notifications require admin or supervisor permission');
      if (scope === 'all' && caller.role !== 'admin') throw new Error('Only system admin can notify all halaqas');
      if (scope === 'halaqa' && targetId && !(await isSupervisorFor(targetId))) throw new Error('You cannot notify this halaqa');
      if (scope === 'category' && targetId && caller.role === 'supervisor') {
        const { data: cat } = await admin.from('student_categories').select('halaqa_id').eq('id', targetId).single();
        if (!cat || !(await isSupervisorFor(cat.halaqa_id))) throw new Error('You cannot notify this category');
      }
      if (scope === 'student' && targetId && caller.role === 'supervisor') {
        const { data: st } = await admin.from('students').select('halaqa_id').eq('id', targetId).single();
        if (!st || !(await isSupervisorFor(st.halaqa_id))) throw new Error('You cannot notify this student');
      }

      const students = await studentIdsForScope(scope, targetId);
      const studentIds = students.map((x: any) => x.id);
      const ids: string[] = [];
      if (audience === 'guardians' || audience === 'all') ids.push(...await guardiansForStudents(studentIds));

      const halaqaIds = uniq(students.map((x: any) => x.halaqa_id));
      if (audience === 'teachers' || audience === 'all') {
        if (scope === 'all') {
          const { data } = await admin.from('profiles').select('id').eq('role', 'teacher').eq('active', true).eq('approval_status', 'approved');
          ids.push(...(data || []).map((x: any) => x.id));
        } else if (halaqaIds.length) {
          const { data } = await admin.from('halaqa_teachers').select('teacher_id').in('halaqa_id', halaqaIds);
          ids.push(...(data || []).map((x: any) => x.teacher_id));
        }
      }
      if (audience === 'all') {
        if (scope === 'all') {
          const { data } = await admin.from('profiles').select('id').in('role', ['admin', 'supervisor']).eq('active', true).eq('approval_status', 'approved');
          ids.push(...(data || []).map((x: any) => x.id));
        } else if (halaqaIds.length) {
          const { data } = await admin.from('halaqa_supervisors').select('supervisor_id').in('halaqa_id', halaqaIds);
          ids.push(...(data || []).map((x: any) => x.supervisor_id));
          if (caller.role === 'admin') ids.push(callerId);
        }
      }
      return await activeProfileIds(ids);
    }

    function preferenceField(kind: string) {
      if (kind === 'attendance') return 'attendance';
      if (kind === 'recitation') return 'recitation';
      if (kind === 'behavior') return 'behavior';
      if (kind === 'achievement') return 'achievements';
      return 'announcements';
    }

    async function deliver(recipientIds: string[], payload: any) {
      const recipients = uniq(recipientIds).filter(id => id !== callerId || payload.include_sender === true);
      if (!recipients.length) return { recipients: 0, created: 0, push_sent: 0, push_skipped: 0, push_configured: !!Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON') };
      const sourceKey = String(payload.source_key || `manual:${crypto.randomUUID()}`);
      const { data: existing, error: existingError } = await admin.from('notifications').select('recipient_id').eq('source_key', sourceKey).in('recipient_id', recipients);
      if (existingError) throw existingError;
      const existingSet = new Set((existing || []).map((x: any) => x.recipient_id));
      const rows = recipients.map(recipient_id => ({
        recipient_id,
        sender_id: callerId,
        halaqa_id: payload.halaqa_id || null,
        student_id: payload.student_id || null,
        session_id: payload.session_id || null,
        kind: payload.kind || 'manual',
        title: String(payload.title || 'حلقتي'),
        body: String(payload.body || ''),
        source_key: sourceKey,
        deep_link: payload.deep_link || null,
        data: payload.data || {},
        push_status: 'pending',
        push_error: null,
      }));
      const { error: upsertError } = await admin.from('notifications').upsert(rows, { onConflict: 'recipient_id,source_key' });
      if (upsertError) throw upsertError;

      const newRecipients = recipients.filter(id => !existingSet.has(id));
      if (!newRecipients.length) return { recipients: recipients.length, created: 0, push_sent: 0, push_skipped: 0, push_configured: !!Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON') };

      const { data: prefRows } = await admin.from('notification_preferences').select('*').in('user_id', newRecipients);
      const prefMap = new Map((prefRows || []).map((x: any) => [x.user_id, x]));
      const prefField = preferenceField(payload.kind || 'manual');
      const allowedUsers = newRecipients.filter(id => {
        const p: any = prefMap.get(id);
        if (!p) return true;
        return p.push_enabled !== false && p[prefField] !== false;
      });

      const { data: devices, error: devError } = allowedUsers.length
        ? await admin.from('user_devices').select('id,user_id,push_token').in('user_id', allowedUsers).eq('active', true)
        : { data: [], error: null } as any;
      if (devError) throw devError;

      let sent = 0, skipped = 0, failed = 0;
      const statusByUser = new Map<string, { sent: boolean, errors: string[] }>();
      for (const userId of newRecipients) statusByUser.set(userId, { sent: false, errors: [] });
      for (const d of devices || []) {
        try {
          const result: any = await sendFcm(d.push_token, payload.title, payload.body, {
            notification_id: sourceKey,
            kind: payload.kind || 'manual',
            deep_link: payload.deep_link || '',
            student_id: payload.student_id || '',
            halaqa_id: payload.halaqa_id || '',
            session_id: payload.session_id || '',
            ...payload.data,
          });
          if (result.ok) { sent++; statusByUser.get(d.user_id)!.sent = true; }
          else if (result.skipped) { skipped++; statusByUser.get(d.user_id)!.errors.push(result.error || 'push skipped'); }
          else {
            failed++; statusByUser.get(d.user_id)!.errors.push(result.error || 'push failed');
            if (result.invalid) await admin.from('user_devices').update({ active: false }).eq('id', d.id);
          }
        } catch (e) {
          failed++; statusByUser.get(d.user_id)!.errors.push(String((e as any)?.message || e));
        }
      }
      for (const [userId, st] of statusByUser) {
        const hasDevice = (devices || []).some((x: any) => x.user_id === userId);
        const pushStatus = st.sent ? 'sent' : (!Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON') || !hasDevice ? 'skipped' : 'error');
        const errorText = st.errors.join(' | ').slice(0, 800) || (!hasDevice ? 'No active device token' : null);
        await admin.from('notifications').update({ push_status: pushStatus, push_error: errorText }).eq('recipient_id', userId).eq('source_key', sourceKey);
      }
      return { recipients: recipients.length, created: newRecipients.length, push_sent: sent, push_skipped: skipped, push_failed: failed, push_configured: !!Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON') };
    }

    if (action === 'register_device') {
      const pushToken = String(body.push_token || '').trim();
      if (!pushToken) return json({ error: 'push_token is required' }, 400);
      const platform = ['android','ios','web'].includes(String(body.platform || '')) ? String(body.platform) : 'android';
      const row = { user_id: callerId, push_token: pushToken, platform, device_name: body.device_name || null, app_version: body.app_version || null, active: true, last_seen_at: new Date().toISOString() };
      const { data, error } = await admin.from('user_devices').upsert(row, { onConflict: 'push_token' }).select('id,user_id,platform,active').single();
      if (error) throw error;
      return json({ ok: true, device: data });
    }

    if (action === 'unregister_device') {
      const pushToken = String(body.push_token || '').trim();
      if (!pushToken) return json({ error: 'push_token is required' }, 400);
      const { error } = await admin.from('user_devices').update({ active: false, last_seen_at: new Date().toISOString() }).eq('push_token', pushToken).eq('user_id', callerId);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === 'event_student') {
      const studentId = String(body.student_id || '');
      if (!studentId) return json({ error: 'student_id is required' }, 400);
      const { data: st, error } = await admin.from('students').select('id,halaqa_id,full_name').eq('id', studentId).single();
      if (error || !st) return json({ error: 'Student not found' }, 404);
      if (!(await canWriteStudentEvent(st.halaqa_id))) return json({ error: 'Not allowed for this student' }, 403);
      const guardians = await guardiansForStudents([studentId]);
      const result = await deliver(await activeProfileIds(guardians), {
        kind: String(body.kind || 'system'),
        title: String(body.title || `تحديث ${st.full_name}`),
        body: String(body.body || ''),
        source_key: String(body.source_key || `${body.kind || 'system'}:${studentId}:${body.session_id || crypto.randomUUID()}`),
        halaqa_id: st.halaqa_id,
        student_id: studentId,
        session_id: body.session_id || null,
        deep_link: body.deep_link || `student:${studentId}`,
        data: body.data || {},
      });
      return json({ ok: true, ...result });
    }

    if (action === 'manual') {
      const scope = String(body.scope || 'halaqa');
      const targetId = body.target_id ? String(body.target_id) : null;
      const audience = String(body.audience || 'guardians');
      if (!['all', 'halaqa', 'category', 'student'].includes(scope)) return json({ error: 'Invalid scope' }, 400);
      if (scope !== 'all' && !targetId) return json({ error: 'target_id is required' }, 400);
      const recipientIds = await recipientsForManual(scope, targetId, audience);
      let halaqaId = scope === 'halaqa' ? targetId : null;
      let studentId = scope === 'student' ? targetId : null;
      if (scope === 'student' && targetId) {
        const { data: st } = await admin.from('students').select('halaqa_id').eq('id', targetId).maybeSingle();
        halaqaId = st?.halaqa_id || null;
      }
      if (scope === 'category' && targetId) {
        const { data: cat } = await admin.from('student_categories').select('halaqa_id').eq('id', targetId).maybeSingle();
        halaqaId = cat?.halaqa_id || null;
      }
      const result = await deliver(recipientIds, {
        kind: body.kind === 'achievement' ? 'achievement' : 'manual',
        title: String(body.title || 'إشعار من حلقتي'),
        body: String(body.body || ''),
        source_key: String(body.source_key || `manual:${callerId}:${crypto.randomUUID()}`),
        halaqa_id: halaqaId,
        student_id: studentId,
        deep_link: body.deep_link || 'notifications',
        data: { scope, target_id: targetId || '', audience, ...(body.data || {}) },
      });
      return json({ ok: true, ...result });
    }

    if (action === 'announcement') {
      if (!['admin', 'supervisor'].includes(caller.role)) return json({ error: 'Announcement push requires admin or supervisor permission' }, 403);
      const announcementId = String(body.announcement_id || '');
      const { data: a, error } = await admin.from('announcements').select('*').eq('id', announcementId).single();
      if (error || !a) return json({ error: 'Announcement not found' }, 404);
      if (a.halaqa_id && !(await isSupervisorFor(a.halaqa_id))) return json({ error: 'Not allowed for this halaqa' }, 403);
      const scope = a.halaqa_id ? 'halaqa' : 'all';
      const audience = a.audience === 'teachers' ? 'teachers' : a.audience === 'all' ? 'all' : 'guardians';
      const recipients = await recipientsForManual(scope, a.halaqa_id || null, audience);
      const result = await deliver(recipients, {
        kind: a.category === 'achievement' ? 'achievement' : 'announcement',
        title: a.title,
        body: a.body,
        source_key: `announcement:${a.id}`,
        halaqa_id: a.halaqa_id || null,
        deep_link: 'community',
        data: { announcement_id: a.id, priority: a.priority || 'normal', category: a.category || 'general' },
      });
      return json({ ok: true, ...result });
    }

    if (action === 'test_push') {
      const result = await deliver([callerId], {
        include_sender: true,
        kind: 'system',
        title: 'اختبار إشعارات حلقتي',
        body: 'إذا ظهر هذا الإشعار فإعداد Push على هذا الجهاز يعمل بشكل صحيح.',
        source_key: `test:${callerId}:${crypto.randomUUID()}`,
        deep_link: 'notifications',
      });
      return json({ ok: true, ...result });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
