import { admin, getUser, verifyRequestOrigin } from '@netlify/identity';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function requireAdmin(request: Request) {
  if (request.method !== 'GET') verifyRequestOrigin(request);
  const session = await getUser();
  if (!session) throw new HttpError(401, 'Please log in to continue.');
  const user = await admin.getUser(session.id);
  if (!user.roles?.includes('admin')) throw new HttpError(403, 'Administrator access is required.');
  return user;
}

export function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function failure(error: unknown) {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  if (error instanceof SyntaxError) return json({ error: 'Invalid request data.' }, 400);
  if (error instanceof Error && 'status' in error && error.status === 403) return json({ error: 'Request not allowed.' }, 403);
  return json({ error: 'This action is unavailable right now. Please try again later.' }, 503);
}

export function identifier(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new HttpError(400, 'Invalid record ID.');
  return value;
}

export async function body(request: Request): Promise<Record<string, unknown>> {
  const input = await request.text();
  if (input.length > 16000) throw new HttpError(413, 'Request is too large.');
  const value = JSON.parse(input);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'Invalid request data.');
  return value;
}
