import { admin } from '@netlify/identity';
import { body, failure, HttpError, identifier, json, requireAdmin } from '../lib/security.js';

export default async (request: Request) => {
  try {
    if (!['GET', 'PATCH', 'DELETE'].includes(request.method)) return json({ error: 'Method not allowed.' }, 405);
    const currentUser = await requireAdmin(request);
    if (request.method === 'GET') {
      const page = Number(new URL(request.url).searchParams.get('page') || 1);
      if (!Number.isInteger(page) || page < 1) throw new HttpError(400, 'Invalid page.');
      const users = await admin.listUsers({ page, perPage: 50 });
      return json({ users: users.map(user => ({ id: user.id, email: user.email, name: user.name, roles: user.roles || [], confirmedAt: user.confirmedAt })), page, hasMore: users.length === 50 });
    }
    const input = await body(request);
    const userId = identifier(input.id);
    if (userId === currentUser.id) throw new HttpError(400, 'You cannot delete your own account or change your own admin role.');
    if (request.method === 'DELETE') {
      await admin.deleteUser(userId);
    } else {
      if (typeof input.isAdmin !== 'boolean') throw new HttpError(400, 'Invalid role selection.');
      const user = await admin.getUser(userId);
      const roles = (user.roles || []).filter(role => role !== 'admin');
      if (input.isAdmin) roles.push('admin');
      await admin.updateUser(userId, { app_metadata: { ...user.appMetadata, roles } });
    }
    return json({ success: true });
  } catch (error) { return failure(error); }
};
