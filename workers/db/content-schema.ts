import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const posts = sqliteTable(
  "posts",
  {
    id: text("id").primaryKey(),
    caption: text("caption"),
    category: text("category").notNull().default("other"),
    likes: integer("likes").default(0),
    comments: integer("comments").default(0),
    takenAt: text("taken_at"),
    createdAt: text("created_at").notNull(),
    tier: text("tier").notNull().default("free"),  // "free", "subscribers", "ppv"
    ppvPrice: integer("ppv_price"),  // in cents
    platform: text("platform").notNull().default("instagram"),
    externalId: text("external_id"),
    isExclusive: integer("is_exclusive").default(0),
    nsfwScore: integer("nsfw_score"),
  },
  (table) => [index("idx_posts_created").on(table.createdAt)],
);

export const media = sqliteTable(
  "media",
  {
    id: text("id").primaryKey(),
    postId: text("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("image"),  // "image" or "video"
    r2Key: text("r2_key").notNull(),
    contentType: text("content_type").notNull().default("image/jpeg"),
    sizeBytes: integer("size_bytes"),
    width: integer("width"),
    height: integer("height"),
    category: text("category"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_media_post").on(table.postId)],
);
