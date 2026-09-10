import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPostsByLang, slugOf } from '../../lib/posts';
import { routes } from '../../i18n/ui';
import { SITE } from '../../lib/site';

export async function GET(context: APIContext) {
  const posts = await getPostsByLang('en');
  return rss({
    title: SITE.name,
    description: 'Articles, guides and news about coders applying software to DIY projects.',
    site: context.site ?? SITE.url,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `${routes.en.postBase}${slugOf(post)}/`,
    })),
    customData: '<language>en</language>',
  });
}
