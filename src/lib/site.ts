export const SITE = {
  name: 'CoderDIY',
  domain: 'coderdiy.com',
  url: 'https://coderdiy.com',
  socials: {
    // Fill these in once the accounts exist.
    github: 'https://github.com/coderdiy',
    youtube: '',
    facebook: '',
  },
  // Update once the GitHub repo (with Discussions enabled) and giscus app
  // are set up. See src/components/Comments.astro for details.
  giscus: {
    repo: 'coderdiy/coderdiy.com',
    repoId: '',
    category: 'General',
    categoryId: '',
    configured: false,
  },
} as const;
