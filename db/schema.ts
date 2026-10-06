import { pgTable, uuid, text, timestamp, boolean } from 'drizzle-orm/pg-core';

export const content = pgTable('church_content', {
  id: uuid('id').defaultRandom().primaryKey(),
  kind: text('kind').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  url: text('url').notNull().default(''),
  eventDate: timestamp('event_date', { withTimezone: true }),
  location: text('location').notNull().default(''),
  published: boolean('published').notNull().default(true),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
