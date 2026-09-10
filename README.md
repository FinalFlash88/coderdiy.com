# CoderDIY.com

Trang tin tức / bài viết / diễn đàn dành cho coder thích tự tay làm (DIY) — Arduino, ESP32, Raspberry Pi, tự động hoá nhà, in 3D...

Xây bằng [Astro](https://astro.build) + Tailwind CSS v4, nội dung song ngữ Việt/Anh, deploy tĩnh lên Cloudflare Pages.

## Cấu trúc nội dung

- **Bài viết** (`/bai-viet/`, `/en/articles/`) — hướng dẫn, nhật ký dự án DIY.
- **Tin tức** (`/tin-tuc/`, `/en/news/`) — cập nhật công cụ, phần cứng, cộng đồng.
- **Diễn đàn** (`/dien-dan/`, `/en/forum/`) — không phải một khu vực tách biệt, mà là phần bình luận (giscus, dựa trên GitHub Discussions) gắn ngay dưới mỗi bài viết.

Bài viết là các file Markdown/MDX trong `src/content/posts/vi/` và `src/content/posts/en/`. Hai bản dịch của cùng một bài được nối với nhau qua field `translationId` trong frontmatter — đặt cùng giá trị `translationId` cho bản vi và bản en để nút "Đọc bằng tiếng Anh / Đọc bằng tiếng Việt" hoạt động.

Xem `src/content.config.ts` để biết đầy đủ schema frontmatter (title, description, pubDate, category: "news" | "article", tags, heroEmoji, author, draft...).

## Phát triển local

```sh
npm install
npm run dev        # http://localhost:4321
npm run build       # build ra ./dist
npm run preview     # xem thử bản build
```

## Thêm một bài viết mới

1. Tạo file trong `src/content/posts/vi/ten-bai-viet.md` (và bản dịch tương ứng trong `src/content/posts/en/`).
2. Điền frontmatter, đặt `translationId` giống nhau ở cả hai file.
3. Viết nội dung bằng Markdown bên dưới `---`.
4. Chạy `npm run dev` để xem trước tại `/bai-viet/ten-bai-viet/` (hoặc `/en/posts/...`).

## Bật bình luận / diễn đàn (giscus)

Khu vực bình luận hiện đang hiển thị thông báo "chưa cấu hình" vì cần một GitHub repo công khai đã bật Discussions:

1. Tạo (hoặc dùng) một repo GitHub công khai, ví dụ `coderdiy/coderdiy.com`.
2. Bật **Discussions** trong tab Settings của repo.
3. Cài GitHub App [giscus](https://github.com/apps/giscus) cho repo đó.
4. Vào https://giscus.app, điền tên repo, chọn category (nên tạo category "General" hoặc "Comments" kiểu Announcement), trang sẽ sinh ra `data-repo-id` và `data-category-id`.
5. Mở `src/lib/site.ts`, điền `repoId`, `categoryId`, và đổi `configured: true`.

## Deploy lên Cloudflare Pages

Domain `coderdiy.com` đã có sẵn trên tài khoản Cloudflare. Cách nhanh nhất:

1. Đẩy repo này lên GitHub (hoặc GitLab).
2. Trong Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**, chọn repo.
3. Build settings:
   - Framework preset: `Astro`
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Sau khi deploy xong, vào **Custom domains** của dự án Pages và thêm `coderdiy.com` (và `www.coderdiy.com` nếu muốn) — vì domain đã ở cùng tài khoản Cloudflare nên DNS sẽ tự nối, không cần đổi nameserver.

Không cần Git cũng deploy được bằng Wrangler:

```sh
npm run build
npx wrangler pages deploy dist --project-name=coderdiy
```

## Cấu trúc thư mục

```
src/
├── content/posts/{vi,en}/   bài viết Markdown
├── content.config.ts         schema cho content collection "posts"
├── i18n/ui.ts                bảng dịch UI + đường dẫn theo ngôn ngữ
├── lib/posts.ts               helper truy vấn bài viết (theo lang/category/slug)
├── lib/site.ts                tên site, social links, cấu hình giscus
├── layouts/BaseLayout.astro   khung HTML, SEO, hreflang, dark mode
├── components/                Header, Footer, PostCard, PostListing, Comments...
└── pages/                     vi ở gốc "/", en dưới "/en/"
```
