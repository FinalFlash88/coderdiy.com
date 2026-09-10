export const defaultLang = 'vi' as const;
export type Lang = 'vi' | 'en';

export const languageNames: Record<Lang, string> = {
  vi: 'Tiếng Việt',
  en: 'English',
};

// Path segments differ per language so URLs read naturally in each locale.
// vi lives at the site root (no prefix), en is prefixed with /en/.
export const routes = {
  vi: {
    home: '/',
    news: '/tin-tuc/',
    articles: '/bai-viet/',
    postBase: '/bai-viet/',
    forum: '/dien-dan/',
    about: '/gioi-thieu/',
    rss: '/rss.xml',
  },
  en: {
    home: '/en/',
    news: '/en/news/',
    articles: '/en/articles/',
    postBase: '/en/posts/',
    forum: '/en/forum/',
    about: '/en/about/',
    rss: '/en/rss.xml',
  },
} as const;

export const ui = {
  vi: {
    'site.tagline': 'Nơi coder biến ý tưởng thành đồ vật thật',
    'site.description':
      'CoderDIY là trang tin tức, bài viết và diễn đàn dành cho những coder thích tự tay làm (DIY) — từ Arduino, ESP32, Raspberry Pi đến tự động hoá nhà thông minh.',

    'nav.home': 'Trang chủ',
    'nav.news': 'Tin tức',
    'nav.articles': 'Bài viết',
    'nav.forum': 'Diễn đàn',
    'nav.about': 'Giới thiệu',
    'nav.theme': 'Đổi giao diện sáng/tối',
    'nav.language': 'English',

    'home.hero.eyebrow': 'Code x DIY',
    'home.hero.title': 'Lập trình gặp thủ công.',
    'home.hero.subtitle':
      'Bài viết, hướng dẫn và tin tức về việc coder ứng dụng lập trình vào các dự án DIY: mạch điện, robot, nhà thông minh, in 3D và hơn thế nữa.',
    'home.hero.cta.articles': 'Xem bài viết',
    'home.hero.cta.news': 'Xem tin tức',
    'home.latestNews': 'Tin tức mới nhất',
    'home.latestArticles': 'Bài viết mới nhất',
    'home.viewAll': 'Xem tất cả',
    'home.forum.title': 'Tham gia thảo luận',
    'home.forum.body':
      'Mỗi bài viết đều có khu vực bình luận để bạn đặt câu hỏi, góp ý hoặc khoe thành quả DIY của riêng mình.',
    'home.forum.cta': 'Đến diễn đàn',

    'category.news': 'Tin tức',
    'category.article': 'Bài viết',

    'list.news.title': 'Tin tức',
    'list.news.subtitle': 'Cập nhật về công cụ, phần cứng và cộng đồng maker liên quan đến lập trình & DIY.',
    'list.articles.title': 'Bài viết',
    'list.articles.subtitle': 'Hướng dẫn từng bước và nhật ký dự án DIY ứng dụng code.',
    'list.empty': 'Chưa có bài viết nào ở đây.',

    'post.publishedOn': 'Đăng ngày',
    'post.updatedOn': 'Cập nhật',
    'post.author': 'Tác giả',
    'post.backToList': 'Quay lại danh sách',
    'post.tags': 'Thẻ',
    'post.otherLang': 'Đọc bằng tiếng Anh',
    'post.comments.title': 'Bình luận',
    'post.comments.notConfigured':
      'Khu vực bình luận (diễn đàn) sẽ hoạt động sau khi kết nối giscus với GitHub Discussions của dự án.',

    'forum.title': 'Diễn đàn',
    'forum.subtitle': 'CoderDIY dùng giscus — thảo luận gắn liền với từng bài viết, chạy trên nền GitHub Discussions.',
    'forum.body1':
      'Không có một "diễn đàn" tách biệt — mỗi bài viết bên dưới chính là một chủ đề thảo luận. Mở một bài viết bất kỳ, cuộn xuống cuối trang để bình luận, đặt câu hỏi hoặc chia sẻ dự án tương tự của bạn.',
    'forum.body2':
      'Cách này giúp thảo luận luôn gắn với đúng ngữ cảnh, không bị trôi bài, và tận dụng tài khoản GitHub bạn đã có sẵn.',
    'forum.browse': 'Duyệt bài viết để thảo luận',

    'about.title': 'Giới thiệu CoderDIY',
    'about.body1':
      'CoderDIY.com là nơi dành cho những người vừa biết code, vừa thích lắp ráp, hàn mạch và chế tạo đồ vật thật ngoài đời. Trang chia làm ba phần: Bài viết (hướng dẫn, nhật ký dự án), Tin tức (cập nhật công cụ, phần cứng, cộng đồng) và Diễn đàn (thảo luận trên từng bài viết).',
    'about.body2':
      'Mục tiêu là xây một cộng đồng nhỏ nhưng chất lượng, nơi kiến thức lập trình được áp dụng vào những thứ bạn có thể cầm, nắm và cắm điện lên.',
    'about.contact': 'Liên hệ / đóng góp bài viết',

    'footer.tagline': 'Lập trình gặp thủ công.',
    'footer.rights': 'Giữ mọi quyền.',
    'footer.builtWith': 'Xây dựng bằng Astro, lưu trữ trên Cloudflare.',

    '404.title': 'Không tìm thấy trang',
    '404.body': 'Trang bạn tìm không tồn tại hoặc đã được di chuyển.',
    '404.cta': 'Về trang chủ',
  },
  en: {
    'site.tagline': 'Where coders turn ideas into physical things',
    'site.description':
      'CoderDIY is a news, articles and forum site for coders who like to build things by hand — Arduino, ESP32, Raspberry Pi, home automation and more.',

    'nav.home': 'Home',
    'nav.news': 'News',
    'nav.articles': 'Articles',
    'nav.forum': 'Forum',
    'nav.about': 'About',
    'nav.theme': 'Toggle light/dark theme',
    'nav.language': 'Tiếng Việt',

    'home.hero.eyebrow': 'Code x DIY',
    'home.hero.title': 'Where code meets craft.',
    'home.hero.subtitle':
      'Articles, guides and news about coders applying software to DIY projects: circuits, robots, smart homes, 3D printing and more.',
    'home.hero.cta.articles': 'Browse articles',
    'home.hero.cta.news': 'Browse news',
    'home.latestNews': 'Latest news',
    'home.latestArticles': 'Latest articles',
    'home.viewAll': 'View all',
    'home.forum.title': 'Join the discussion',
    'home.forum.body':
      'Every article has a comments section so you can ask questions, give feedback, or show off your own build.',
    'home.forum.cta': 'Go to the forum',

    'category.news': 'News',
    'category.article': 'Article',

    'list.news.title': 'News',
    'list.news.subtitle': 'Updates on tools, hardware and the maker community, for coders who build.',
    'list.articles.title': 'Articles',
    'list.articles.subtitle': 'Step-by-step guides and project logs where code meets DIY.',
    'list.empty': 'No posts here yet.',

    'post.publishedOn': 'Published',
    'post.updatedOn': 'Updated',
    'post.author': 'Author',
    'post.backToList': 'Back to list',
    'post.tags': 'Tags',
    'post.otherLang': 'Đọc bằng tiếng Việt',
    'post.comments.title': 'Comments',
    'post.comments.notConfigured':
      'The comments section (forum) will go live once giscus is connected to the project’s GitHub Discussions.',

    'forum.title': 'Forum',
    'forum.subtitle': 'CoderDIY uses giscus — discussion threads attached to each post, powered by GitHub Discussions.',
    'forum.body1':
      'There isn’t a separate "forum" section — every article below is a discussion thread in itself. Open any post and scroll to the bottom to comment, ask questions, or share your own build.',
    'forum.body2':
      'This keeps discussion tied to the right context, nothing gets buried, and it reuses the GitHub account you already have.',
    'forum.browse': 'Browse posts to discuss',

    'about.title': 'About CoderDIY',
    'about.body1':
      'CoderDIY.com is for people who both write code and like to solder, assemble and build real physical things. The site has three parts: Articles (guides, project logs), News (tools, hardware, community updates) and Forum (discussion attached to each article).',
    'about.body2':
      'The goal is a small but high-signal community where programming knowledge gets applied to things you can hold, plug in, and turn on.',
    'about.contact': 'Contact / contribute an article',

    'footer.tagline': 'Where code meets craft.',
    'footer.rights': 'All rights reserved.',
    'footer.builtWith': 'Built with Astro, hosted on Cloudflare.',

    '404.title': 'Page not found',
    '404.body': 'The page you’re looking for doesn’t exist or has moved.',
    '404.cta': 'Back to home',
  },
} as const;

export type UIKey = keyof typeof ui.vi;

export function useTranslations(lang: Lang) {
  return function t(key: UIKey): string {
    return ui[lang][key] ?? ui[defaultLang][key];
  };
}
