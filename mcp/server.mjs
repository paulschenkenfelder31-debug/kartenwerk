import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createCard, deleteCard, findUserByEmail, normalizeEmail, readCards, updateCard } from '../lib/store.mjs';

const server = new McpServer({ name: 'kartenwerk-local', version: '0.2.0' });

async function getConfiguredUser() {
  const email = normalizeEmail(process.env.KARTENWERK_USER_EMAIL);
  if (!email) throw new Error('Setze KARTENWERK_USER_EMAIL in der MCP-Konfiguration auf die E-Mail deines lokalen Kontos.');
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`Für ${email} gibt es noch kein lokales Kartenwerk-Konto. Erstelle zuerst ein Konto in der Website.`);
  return user;
}

server.registerTool('create_task_card', {
  title: 'Lokale Aufgabenkarte erstellen',
  description: 'Erstellt im lokalen Kartenwerk eine Aufgabenkarte für das in KARTENWERK_USER_EMAIL konfigurierte Konto. Wenn der Nutzer ein Bild mitsendet, lies es aus, fasse den relevanten Inhalt kurz in der Beschreibung zusammen und schlage passende Checklistenpunkte vor. Erfinde kein Datum: lasse dueDate leer, falls keines genannt wurde. Wichtigkeit und Dringlichkeit sind low, medium oder high. Es werden keine externen Bild-URLs gespeichert.',
  inputSchema: {
    title: z.string().min(1).max(120),
    description: z.string().max(2000).optional(),
    importance: z.enum(['low', 'medium', 'high']).default('medium'),
    urgency: z.enum(['low', 'medium', 'high']).default('medium'),
    dueDate: z.string().optional().describe('Optionales Fälligkeitsdatum im Format YYYY-MM-DD.'),
    checklist: z.array(z.string().max(240)).max(30).default([]),
    imageDataUrl: z.string().max(2_800_000).optional().describe('Optionales lokal gespeichertes Bild als data:image/...;base64,...')
  }
}, async ({ title, description, importance, urgency, dueDate, checklist, imageDataUrl }) => {
  try {
    const user = await getConfiguredUser();
    if (imageDataUrl && !/^data:image\/(png|jpeg|webp|gif);base64,/i.test(imageDataUrl)) throw new Error('Das Bild muss als lokales PNG, JPEG, WebP oder GIF vorliegen.');
    const card = await createCard(user.id, { title, description, importance, urgency, dueDate, checklist, image: imageDataUrl || '' });
    return { content: [{ type: 'text', text: `Lokale Karte „${card.title}“ wurde angelegt. ID: ${card.id}` }] };
  } catch (error) {
    return { isError: true, content: [{ type: 'text', text: error.message }] };
  }
});

server.registerTool('list_task_cards', {
  title: 'Lokale Aufgabenkarten anzeigen',
  description: 'Zeigt Aufgabenkarten des lokal konfigurierten Kontos. Alle Karten bleiben auf diesem Rechner.',
  inputSchema: { status: z.enum(['all', 'open', 'done']).default('all') }
}, async ({ status }) => {
  try {
    const user = await getConfiguredUser();
    const cards = await readCards(user.id);
    const filtered = cards.filter((card) => status === 'all' || (status === 'done' ? card.checklist.length > 0 && card.checklist.every((item) => item.done) : !(card.checklist.length > 0 && card.checklist.every((item) => item.done))));
    return { content: [{ type: 'text', text: JSON.stringify(filtered.map(({ id, title, description, importance, urgency, dueDate, checklist }) => ({ id, title, description, importance, urgency, dueDate, checklist })), null, 2) }] };
  } catch (error) {
    return { isError: true, content: [{ type: 'text', text: error.message }] };
  }
});

server.registerTool('update_checklist_item', {
  title: 'Lokalen Checklistenpunkt abhaken',
  description: 'Markiert einen Checklistenpunkt im lokalen Kartenwerk als erledigt oder offen.',
  inputSchema: { cardId: z.string(), itemId: z.string(), done: z.boolean() }
}, async ({ cardId, itemId, done }) => {
  try {
    const user = await getConfiguredUser();
    const card = (await readCards(user.id)).find((entry) => entry.id === cardId);
    if (!card) throw new Error('Karte nicht gefunden.');
    const checklist = card.checklist.map((item) => item.id === itemId ? { ...item, done } : item);
    const allDone = checklist.length > 0 && checklist.every((item) => item.done);
    const updated = await updateCard(user.id, cardId, { checklist, done:allDone });
    return { content: [{ type: 'text', text: `„${updated.title}“: Checklistenpunkt aktualisiert.` }] };
  } catch (error) {
    return { isError: true, content: [{ type: 'text', text: error.message }] };
  }
});

server.registerTool('mark_task_done', {
  title: 'Lokale Karte erledigen',
  description: 'Markiert eine komplette lokale Aufgabenkarte als erledigt oder öffnet sie wieder.',
  inputSchema: { cardId: z.string(), done: z.boolean().default(true) }
}, async ({ cardId, done }) => {
  try {
    const user = await getConfiguredUser();
    const card = await updateCard(user.id, cardId, { done });
    if (!card) throw new Error('Karte nicht gefunden.');
    return { content: [{ type: 'text', text: `„${card.title}“ wurde ${done ? 'erledigt' : 'wieder geöffnet'}.` }] };
  } catch (error) {
    return { isError: true, content: [{ type: 'text', text: error.message }] };
  }
});

server.registerTool('delete_task_card', {
  title: 'Lokale Aufgabenkarte löschen',
  description: 'Löscht eine Aufgabenkarte aus dem lokalen Kartenwerk.',
  inputSchema: { cardId: z.string() }
}, async ({ cardId }) => {
  try {
    const user = await getConfiguredUser();
    if (!await deleteCard(user.id, cardId)) throw new Error('Karte nicht gefunden.');
    return { content: [{ type: 'text', text: 'Die lokale Aufgabenkarte wurde gelöscht.' }] };
  } catch (error) {
    return { isError: true, content: [{ type: 'text', text: error.message }] };
  }
});

await server.connect(new StdioServerTransport());
