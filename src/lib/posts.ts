import { getCollection, type CollectionEntry } from 'astro:content';
import type { Lang } from '../i18n/ui';

export type Post = CollectionEntry<'posts'>;

/** The part of the entry id after the "vi/" or "en/" folder prefix. */
export function slugOf(post: Post): string {
  return post.id.replace(/^[a-z]{2}\//, '');
}

const isPublished = (post: Post) =>
  import.meta.env.PROD ? !post.data.draft : true;

export async function getPostsByLang(lang: Lang): Promise<Post[]> {
  const posts = await getCollection('posts', (p) => p.data.lang === lang && isPublished(p));
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export async function getPostsByCategory(lang: Lang, category: 'news' | 'article'): Promise<Post[]> {
  const posts = await getPostsByLang(lang);
  return posts.filter((p) => p.data.category === category);
}

export async function getPostBySlug(lang: Lang, slug: string): Promise<Post | undefined> {
  const posts = await getPostsByLang(lang);
  return posts.find((p) => slugOf(p) === slug);
}

/** Finds the URL of a post's translation in the other language, if it exists. */
export async function getTranslationSlug(post: Post): Promise<string | undefined> {
  const otherLang: Lang = post.data.lang === 'vi' ? 'en' : 'vi';
  const otherPosts = await getPostsByLang(otherLang);
  const match = otherPosts.find((p) => p.data.translationId === post.data.translationId);
  return match ? slugOf(match) : undefined;
}
