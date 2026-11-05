import type { DrizzleD1Database } from 'drizzle-orm/d1';

import type * as schema from './schema';

/** The shop's database: D1 through Drizzle with the shop tables. Each app builds it from its own binding. */
export type ShopDb = DrizzleD1Database<typeof schema>;
