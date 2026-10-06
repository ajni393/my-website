import { and, desc, eq } from 'drizzle-orm';
import { database } from '../../db/index.js';
import { content } from '../../db/schema.js';
import { validateContent } from '../lib/content.js';
import { body, failure, HttpError, identifier, json, requireAdmin } from '../lib/security.js';

export default async (request: Request) => {
  try {
    const params = new URL(request.url).searchParams;
    if (request.method === 'GET') {
      const management = params.get('manage') === 'true';
      if (management) await requireAdmin(request);
      const kind = params.get('kind');
      if (kind && !['video', 'sermon', 'event'].includes(kind)) throw new HttpError(400, 'Invalid content type.');
      const rows = await database().select().from(content).where(and(management ? undefined : eq(content.published, true), kind ? eq(content.kind, kind) : undefined)).orderBy(desc(content.createdAt));
      return json({ items: rows.map(({ createdBy, ...item }) => item) });
    }
    if (!['POST', 'PUT', 'DELETE'].includes(request.method)) return json({ error: 'Method not allowed.' }, 405);
    const user = await requireAdmin(request);
    const input = await body(request);
    if (request.method === 'DELETE') {
      const rows = await database().delete(content).where(eq(content.id, identifier(input.id))).returning({ id: content.id });
      if (!rows.length) throw new HttpError(404, 'Content not found.');
      return json({ success: true });
    }
    const values = validateContent(input);
    const rows = request.method === 'POST'
      ? await database().insert(content).values({ ...values, createdBy: user.id }).returning()
      : await database().update(content).set(values).where(eq(content.id, identifier(input.id))).returning();
    if (!rows.length) throw new HttpError(404, 'Content not found.');
    return json({ success: true }, request.method === 'POST' ? 201 : 200);
  } catch (error) { return failure(error); }
};
