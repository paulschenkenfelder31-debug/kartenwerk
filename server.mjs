import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createCard, createSession, createUser, deleteCard, getSessionUser,
  readCards, removeSession, updateCard, verifyPassword
} from './lib/store.mjs';

const publicRoot = fileURLToPath(new URL('./public/', import.meta.url));
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.ico':'image/x-icon' };
const sessionCookie = 'kartenwerk_session';

function send(res, status, payload, type = 'application/json; charset=utf-8', headers = {}) {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers });
  const body = status === 204 ? undefined : (Buffer.isBuffer(payload) || payload instanceof Uint8Array ? payload : typeof payload === 'string' ? payload : JSON.stringify(payload));
  res.end(body);
}

function getCookie(req, name) {
  const cookies = (req.headers.cookie || '').split(';');
  for (const cookie of cookies) {
    const [key, ...parts] = cookie.trim().split('=');
    if (key === name) return decodeURIComponent(parts.join('='));
  }
  return '';
}

async function jsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 3_200_000) throw Object.assign(new Error('Die Anfrage ist zu groß.'), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
  catch { throw Object.assign(new Error('Ungültige Anfrage.'), { status: 400 }); }
}

function checkSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

async function serve(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);
  const method = req.method || 'GET';
  const writes = ['POST','PATCH','PUT','DELETE'].includes(method);
  if (writes && !checkSameOrigin(req)) return send(res, 403, { error: 'Anfrage von einer anderen Website abgelehnt.' });

  if (pathname.startsWith('/api/')) {
    if (pathname === '/api/register' && method === 'POST') {
      const { name, email, password } = await jsonBody(req);
      const cleanName = String(name || '').trim();
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (cleanName.length < 2 || cleanName.length > 80) return send(res, 400, { error: 'Gib bitte deinen Namen ein (2 bis 80 Zeichen).' });
      if (cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return send(res, 400, { error: 'Bitte gib eine gültige E-Mail-Adresse ein.' });
      if (typeof password !== 'string' || password.length < 10 || password.length > 200) return send(res, 400, { error: 'Dein Passwort muss mindestens 10 Zeichen haben.' });
      const user = await createUser({ name: cleanName, email: cleanEmail, password });
      if (!user) return send(res, 409, { error: 'Für diese E-Mail gibt es schon ein lokales Konto. Melde dich an.' });
      const token = await createSession(user.id);
      return send(res, 201, { user }, 'application/json; charset=utf-8', { 'set-cookie': `${sessionCookie}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000` });
    }

    if (pathname === '/api/login' && method === 'POST') {
      const { email, password } = await jsonBody(req);
      if (typeof password !== 'string' || !email) return send(res, 400, { error: 'Gib E-Mail und Passwort ein.' });
      const user = await verifyPassword(email, password);
      if (!user) return send(res, 401, { error: 'E-Mail oder Passwort stimmt nicht.' });
      const token = await createSession(user.id);
      return send(res, 200, { user }, 'application/json; charset=utf-8', { 'set-cookie': `${sessionCookie}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000` });
    }

    if (pathname === '/api/logout' && method === 'POST') {
      await removeSession(getCookie(req, sessionCookie));
      return send(res, 200, { ok: true }, 'application/json; charset=utf-8', { 'set-cookie': `${sessionCookie}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0` });
    }

    const user = await getSessionUser(getCookie(req, sessionCookie));
    if (pathname === '/api/me' && method === 'GET') return user ? send(res, 200, { user }) : send(res, 200, { user: null });
    if (!user) return send(res, 401, { error: 'Bitte melde dich an.' });

    if (pathname === '/api/cards' && method === 'GET') return send(res, 200, await readCards(user.id));
    if (pathname === '/api/cards' && method === 'POST') {
      const input = await jsonBody(req);
      if (!String(input.title || '').trim()) return send(res, 400, { error: 'Ein Titel ist erforderlich.' });
      if (input.image && !String(input.image).startsWith('data:image/')) return send(res, 400, { error: 'Das Bildformat ist ungültig.' });
      return send(res, 201, await createCard(user.id, input));
    }

    const item = pathname.match(/^\/api\/cards\/([^/]+)$/);
    if (item && method === 'PATCH') {
      const input = await jsonBody(req);
      const allowed = ['title','description','importance','urgency','dueDate','image','checklist','done'];
      const update = Object.fromEntries(Object.entries(input).filter(([key]) => allowed.includes(key)));
      const card = await updateCard(user.id, item[1], update);
      return card ? send(res, 200, card) : send(res, 404, { error: 'Karte nicht gefunden.' });
    }
    if (item && method === 'DELETE') return await deleteCard(user.id, item[1]) ? send(res, 204, '') : send(res, 404, { error: 'Karte nicht gefunden.' });
    return send(res, 404, { error: 'Nicht gefunden.' });
  }

  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = resolve(publicRoot, relative);
  if (!filePath.startsWith(publicRoot)) return send(res, 403, 'Verboten', 'text/plain; charset=utf-8');
  try { return send(res, 200, await readFile(filePath), mime[extname(filePath)] || 'application/octet-stream'); }
  catch { return send(res, 404, 'Nicht gefunden', 'text/plain; charset=utf-8'); }
}

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 4173);
createServer((req, res) => {
  serve(req, res).catch((error) => {
    console.error(error);
    send(res, error.status || 500, { error: error.status ? error.message : 'Lokaler Serverfehler.' });
  });
}).listen(port, host, () => console.log(`Kartenwerk läuft unter http://${host}:${port}`));
