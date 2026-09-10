import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    lang: z.enum(['vi', 'en']),
    // Category groups posts into the site's two content pillars.
    // 'news' -> Tin tức, 'article' -> Bài viết (dự án DIY, hướng dẫn, ...)
    category: z.enum(['news', 'article']),
    tags: z.array(z.string()).default([]),
    // Shared id linking a vi post to its en translation (and vice versa).
    translationId: z.string(),
    draft: z.boolean().default(false),
    // No image assets yet, so cards/heroes render a colored gradient + emoji.
    heroEmoji: z.string().default('🛠️'),
    author: z.string().default('CoderDIY'),
  }),
});

export const collections = { posts };
