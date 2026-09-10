export const SITE = {
  name: 'CoderDIY',
  domain: 'coderdiy.com',
  url: 'https://coderdiy.com',
  socials: {
    github: 'https://github.com/FinalFlash88/coderdiy.com',
    youtube: '',
    facebook: '',
  },
  // Repo has Discussions enabled. Comments will only actually load once the
  // giscus GitHub App is installed on this repo: https://github.com/apps/giscus
  giscus: {
    repo: 'FinalFlash88/coderdiy.com',
    repoId: 'R_kgDOUU2MEg',
    category: 'General',
    categoryId: 'DIC_kwDOUU2MEs4DFTMy',
    configured: true,
  },
} as const;
