import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from './index.mjs';

function testEnvironment() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8'));
  const env = {
    DB: {
      prepare(sql) {
        let values = [];
        return {
          bind(...args) { values = args; return this; },
          async first() { return db.prepare(sql).get(...values) || null; },
          async all() { return { results: db.prepare(sql).all(...values) }; },
          async run() { const result = db.prepare(sql).run(...values); return { meta: { changes: result.changes } }; }
        };
      }
    },
    ASSETS: { fetch: () => new Response('static') },
    AI: { run: async (_model, payload) => {
      assert.equal(payload.messages[0].role, 'user');
      if (Array.isArray(payload.messages[0].content)) {
        assert.equal(payload.messages[0].content[1].type, 'image_url');
        assert.match(payload.messages[0].content[1].image_url.url, /^data:image\/png;base64,/);
      }
      return { response: '```json\n{"title":"Einkauf","description":"Milch holen","importance":"medium","urgency":"high","dueDate":"","checklist":["Liste schreiben","Einkaufen"]}\n```' };
    } }
  };
  const call = async (path, { method = 'GET', data, cookie, origin } = {}) => {
    const response = await worker.fetch(new Request(`https://kartenwerk.example${path}`, {
      method, headers: { ...(data ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...(origin ? { origin } : {}) },
      ...(data ? { body: JSON.stringify(data) } : {})
    }), env);
    return { status: response.status, cookie: response.headers.get('set-cookie'), body: response.status === 204 ? null : await response.json() };
  };
  return { call, db };
}

test('account isolation, session, card CRUD, AI preview and origin protection', async () => {
  const { call, db } = testEnvironment();
  try {
    const first = await call('/api/register', { method: 'POST', data: { name: 'Ada', email: 'ada@example.com', password: 'very-secure-12' } });
    assert.equal(first.status, 201);
    assert.match(first.cookie, /HttpOnly; Secure; SameSite=Strict/);
    const ada = first.cookie.split(';')[0];
    assert.equal((await call('/api/register', { method: 'POST', data: { name: 'Ada', email: 'ada@example.com', password: 'very-secure-12' } })).status, 409);
    const second = await call('/api/register', { method: 'POST', data: { name: 'Bob', email: 'bob@example.com', password: 'very-secure-34' } });
    const bob = second.cookie.split(';')[0];
    assert.equal((await call('/api/login', { method: 'POST', data: { email: 'ada@example.com', password: 'wrong' } })).status, 401);
    assert.equal((await call('/api/me', { cookie: ada })).body.user.email, 'ada@example.com');
    const card = await call('/api/cards', { method: 'POST', cookie: ada, data: { title: 'Einkaufen', checklist: [{ text: 'Milch' }], importance: 'high' } });
    assert.equal(card.status, 201);
    assert.equal((await call('/api/cards', { cookie: bob })).body.length, 0);
    assert.equal((await call(`/api/cards/${card.body.id}`, { method: 'PATCH', cookie: bob, data: { done: true } })).status, 404);
    assert.equal((await call(`/api/cards/${card.body.id}`, { method: 'DELETE', cookie: bob })).status, 404);
    assert.equal((await call('/api/cards', { method: 'POST', cookie: ada, origin: 'https://evil.example', data: { title: 'bad' } })).status, 403);
    const suggestion = await call('/api/suggest', { method: 'POST', cookie: ada, data: { note: 'Milch besorgen' } });
    assert.equal(suggestion.body.title, 'Einkauf');
    assert.equal((await call('/api/cards', { cookie: ada })).body.length, 1, 'AI suggestions are not stored until confirmed');
    assert.equal((await call('/api/suggest', { method: 'POST', cookie: ada, data: { note: 'again' } })).status, 429);
    const imageSuggestion = await call('/api/suggest', { method: 'POST', cookie: bob, data: { image: 'data:image/png;base64,aGVsbG8=' } });
    assert.equal(imageSuggestion.body.title, 'Einkauf');
    const updated = await call(`/api/cards/${card.body.id}`, { method: 'PATCH', cookie: ada, data: { done: true } });
    assert.equal(updated.body.done, true);
    assert.equal((await call(`/api/cards/${card.body.id}`, { method: 'DELETE', cookie: ada })).status, 204);
    assert.equal((await call('/api/logout', { method: 'POST', cookie: ada })).status, 200);
    assert.equal((await call('/api/cards', { cookie: ada })).status, 401);
  } finally { db.close(); }
});
