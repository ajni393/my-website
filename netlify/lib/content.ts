import { videoSource } from '../../src/video.js';
import { HttpError } from './security.js';

export function validateContent(input: Record<string, unknown>) {
  const text = (key: string, maximum: number) => {
    if (input[key] !== undefined && typeof input[key] !== 'string') throw new HttpError(400, `Invalid ${key}.`);
    const value = ((input[key] as string) || '').trim();
    if (value.length > maximum) throw new HttpError(400, `${key} is too long.`);
    return value;
  };
  const kind = text('kind', 20);
  if (!['video', 'sermon', 'event'].includes(kind)) throw new HttpError(400, 'Choose video, sermon, or event.');
  const title = text('title', 160);
  if (!title) throw new HttpError(400, 'A title is required.');
  let url = text('url', 2000);
  if (kind !== 'event') {
    try { url = videoSource(url).url; } catch (error) { throw new HttpError(400, error instanceof Error ? error.message : 'Invalid video link.'); }
  } else {
    url = '';
  }
  const dateText = text('eventDate', 50);
  const eventDate = kind === 'event' && dateText ? new Date(dateText) : null;
  if (kind === 'event' && (!eventDate || Number.isNaN(eventDate.getTime()))) throw new HttpError(400, 'An event date and time are required.');
  if (typeof input.published !== 'boolean') throw new HttpError(400, 'Choose a publication status.');
  return { kind, title, description: text('description', 5000), url, eventDate, location: text('location', 200), published: input.published };
}
