import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPostsByLang, slugOf } from '../lib/posts';
import { routes } from '../i18n/ui';
import { SITE } from '../lib/site';

export async function GET(context: APIContext) {
  const posts = await getPostsByLang('vi');
  return rss({
    title: SITE.name,
    description: 'Bài viết, hướng dẫn và tin tức về việc coder ứng dụng lập trình vào các dự án DIY.',
    site: context.site ?? SITE.url,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `${routes.vi.postBase}${slugOf(post)}/`,
    })),
    customData: '<language>vi</language>',
  });
}
