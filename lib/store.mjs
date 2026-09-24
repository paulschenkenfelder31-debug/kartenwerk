import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdir, open, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scrypt = promisify(scryptCallback);
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const dataPath = resolve(process.env.KARTENWERK_DATA_FILE || resolve(projectRoot, 'data/local.json'));
const lockPath = `${dataPath}.lock`;
let writeQueue = Promise.resolve();

async function readDb() {
  try {
    const data = JSON.parse(await readFile(dataPath, 'utf8'));
    return { users: Array.isArray(data.users) ? data.users : [], sessions: Array.isArray(data.sessions) ? data.sessions : [], cards: Array.isArray(data.cards) ? data.cards : [] };
  } catch (error) {
    if (error.code === 'ENOENT') return { users: [], sessions: [], cards: [] };
    throw error;
  }
}

async function writeDb(db) {
  await mkdir(dirname(dataPath), { recursive: true });
  const tempPath = `${dataPath}.${process.pid}.tmp`;
  await writeFile(tempPath, JSON.stringify(db, null, 2), { mode: 0o600 });
  await rename(tempPath, dataPath);
}

async function acquireLock() {
  await mkdir(dirname(dataPath), { recursive: true });
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      const handle = await open(lockPath, 'wx', 0o600);
      await handle.writeFile(JSON.stringify({ pid: process.pid, createdAt: Date.now() }));
      return handle;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      try {
        const info = await stat(lockPath);
        if (Date.now() - info.mtimeMs > 15000) {
          const lock = JSON.parse(await readFile(lockPath, 'utf8'));
          let alive = true;
          try { process.kill(lock.pid, 0); } catch (ownerError) { if (ownerError.code === 'ESRCH') alive = false; }
          if (!alive) { await unlink(lockPath); continue; }
        }
      } catch (lockError) { if (lockError.code === 'ENOENT') continue; }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  throw new Error('Die lokale Datenbank ist gerade gesperrt. Bitte versuche es gleich erneut.');
}

async function mutate(fn) {
  const current = writeQueue.then(async () => {
    const handle = await acquireLock();
    try {
      const db = await readDb();
      const result = await fn(db);
      await writeDb(db);
      return result;
    } finally {
      await handle.close();
      await unlink(lockPath).catch(() => {});
    }
  });
  writeQueue = current.catch(() => {});
  return current;
}

function hashToken(token) { return createHash('sha256').update(token).digest('hex'); }

export function normalizeEmail(email) { return String(email || '').trim().toLowerCase(); }

export async function findUserByEmail(email) {
  const db = await readDb();
  const user = db.users.find((item) => item.email === normalizeEmail(email));
  if (!user) return null;
  const { passwordSalt, passwordHash, ...safeUser } = user;
  return safeUser;
}

export async function createUser({ name, email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const salt = randomBytes(16).toString('hex');
  const passwordHash = (await scrypt(password, salt, 64)).toString('hex');
  return mutate(async (db) => {
    if (db.users.some((user) => user.email === normalizedEmail)) return null;
    const user = { id: randomUUID(), name: String(name).trim().slice(0, 80), email: normalizedEmail, passwordSalt: salt, passwordHash, createdAt: new Date().toISOString() };
    db.users.push(user);
    const { passwordSalt: ignoredSalt, passwordHash: ignoredHash, ...safeUser } = user;
    return safeUser;
  });
}

export async function verifyPassword(email, password) {
  const db = await readDb();
  const user = db.users.find((item) => item.email === normalizeEmail(email));
  if (!user) return null;
  const candidate = Buffer.from(await scrypt(password, user.passwordSalt, 64));
  const stored = Buffer.from(user.passwordHash, 'hex');
  if (candidate.length !== stored.length || !timingSafeEqual(candidate, stored)) return null;
  const { passwordSalt, passwordHash, ...safeUser } = user;
  return safeUser;
}

export async function createSession(userId) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 30;
  await mutate((db) => {
    db.sessions = db.sessions.filter((session) => session.expiresAt > Date.now());
    db.sessions.push({ tokenHash: hashToken(token), userId, expiresAt });
  });
  return token;
}

export async function getSessionUser(token) {
  if (!token) return null;
  const db = await readDb();
  const hash = hashToken(token);
  const session = db.sessions.find((item) => item.tokenHash === hash && item.expiresAt > Date.now());
  if (!session) return null;
  const user = db.users.find((item) => item.id === session.userId);
  if (!user) return null;
  const { passwordSalt, passwordHash, ...safeUser } = user;
  return safeUser;
}

export async function removeSession(token) {
  if (!token) return;
  const hash = hashToken(token);
  await mutate((db) => { db.sessions = db.sessions.filter((session) => session.tokenHash !== hash); });
}

export function normalizeCard(input, userId) {
  const now = new Date().toISOString();
  return {
    id: input.id || randomUUID(),
    userId,
    title: String(input.title || 'Neue Aufgabe').trim().slice(0, 120),
    description: String(input.description || '').trim().slice(0, 2000),
    importance: ['low', 'medium', 'high'].includes(input.importance) ? input.importance : 'medium',
    urgency: ['low', 'medium', 'high'].includes(input.urgency) ? input.urgency : 'medium',
    dueDate: input.dueDate || '',
    image: input.image || '',
    done: Boolean(input.done),
    checklist: Array.isArray(input.checklist) ? input.checklist.map((item) => typeof item === 'string'
      ? { id: randomUUID(), text: item.trim().slice(0, 240), done: false }
      : { id: item.id || randomUUID(), text: String(item.text || '').trim().slice(0, 240), done: Boolean(item.done) }
    ).filter((item) => item.text).slice(0, 30) : [],
    createdAt: input.createdAt || now,
    updatedAt: now
  };
}

export async function readCards(userId) {
  const db = await readDb();
  return db.cards.filter((card) => card.userId === userId);
}

export async function createCard(userId, input) {
  const card = normalizeCard(input, userId);
  return mutate((db) => { db.cards.unshift(card); return card; });
}

export async function updateCard(userId, id, update) {
  return mutate((db) => {
    const index = db.cards.findIndex((card) => card.id === id && card.userId === userId);
    if (index < 0) return null;
    db.cards[index] = { ...db.cards[index], ...update, id, userId, updatedAt: new Date().toISOString() };
    return db.cards[index];
  });
}

export async function deleteCard(userId, id) {
  return mutate((db) => {
    const length = db.cards.length;
    db.cards = db.cards.filter((card) => !(card.id === id && card.userId === userId));
    return db.cards.length < length;
  });
}
