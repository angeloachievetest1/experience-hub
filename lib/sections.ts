// Navigation and page descriptions for the whole app.

export type SectionKey = 'quality_analyst' | 'curriculum' | 'mentor';

// Where the app opens (there is no separate Home page).
export const START_PAGE = '/quality-analyst';

export type IconName =
  | 'home' | 'grid' | 'chart' | 'list' | 'person' | 'bookmark' | 'clock'
  | 'cap' | 'chat' | 'users' | 'login';

export type PageInfo = {
  href: string;
  label: string;
  title: string;
  subtitle: string;
  icon: IconName;
};

export type NavGroup = {
  key: SectionKey | 'admin';
  name: string;
  pages: PageInfo[];
};

export const SECTION_NAMES: Record<SectionKey, string> = {
  quality_analyst: 'Quality Analyst',
  curriculum: 'Curriculum',
  mentor: 'Mentor',
};

export const SECTION_KEYS = Object.keys(SECTION_NAMES) as SectionKey[];

export const SECTION_GROUPS: NavGroup[] = [
  {
    key: 'quality_analyst',
    name: 'Quality Analyst',
    pages: [
      {
        href: '/quality-analyst',
        label: 'Dashboard',
        title: 'Quality Analyst dashboard',
        subtitle: 'Totals, trends and validity across Instructor, Course, Survey and Returned cases.',
        icon: 'grid',
      },
      {
        href: '/quality-analyst/survey-insights',
        label: 'Survey insights',
        title: 'Survey insights',
        subtitle: 'Low survey scores by month, type and reason.',
        icon: 'chart',
      },
      {
        href: '/quality-analyst/case-log',
        label: 'Case log',
        title: 'Case log',
        subtitle: 'Every Quality Analyst case in one searchable table.',
        icon: 'list',
      },
      {
        href: '/quality-analyst/instructors',
        label: 'Instructor view',
        title: 'Instructor view',
        subtitle: 'Complaints and low scores grouped by instructor.',
        icon: 'person',
      },
      {
        href: '/quality-analyst/courses',
        label: 'Course view',
        title: 'Course view',
        subtitle: 'Complaints and low scores grouped by course.',
        icon: 'bookmark',
      },
      {
        href: '/quality-analyst/resolution',
        label: 'Resolution',
        title: 'Resolution',
        subtitle: 'Customers still waiting on contact or action.',
        icon: 'clock',
      },
    ],
  },
  {
    key: 'curriculum',
    name: 'Curriculum',
    pages: [
      {
        href: '/curriculum',
        label: 'Dashboard',
        title: 'Curriculum dashboard',
        subtitle: 'Customer content complaints at a glance.',
        icon: 'cap',
      },
      {
        href: '/curriculum/case-log',
        label: 'Case log',
        title: 'Case Log',
        subtitle: 'Every Curriculum Customer Cases about course content',
        icon: 'list',
      },
      {
        href: '/curriculum/instructor-requests',
        label: 'Instructor requests',
        title: 'Instructor requests',
        subtitle: 'Content-error feedback from instructors and mentors.',
        icon: 'chat',
      },
    ],
  },
  {
    key: 'mentor',
    name: 'Mentor',
    pages: [
      {
        href: '/mentor',
        label: 'Dashboard',
        title: 'Mentor dashboard',
        subtitle: 'Customer complaints about mentors.',
        icon: 'grid',
      },
      {
        href: '/mentor/case-log',
        label: 'Case log',
        title: 'Case Log',
        subtitle: 'Every mentor complaint in one table.',
        icon: 'list',
      },
    ],
  },
];

export const ADMIN_GROUP: NavGroup = {
  key: 'admin',
  name: 'Experience Hub Dashboard',
  pages: [
    {
      href: '/admin',
      label: 'Users',
      title: 'Users',
      subtitle: 'Who can sign in, and what they can do.',
      icon: 'users',
    },
    {
      href: '/admin/activity-log',
      label: 'Activity Log',
      title: 'Activity Log',
      subtitle: 'Every change to cases and user access.',
      icon: 'clock',
    },
    {
      href: '/admin/login-history',
      label: 'Login History',
      title: 'Login History',
      subtitle: 'Every successful sign-in.',
      icon: 'login',
    },
  ],
};

export function findPage(href: string): PageInfo {
  for (const group of [...SECTION_GROUPS, ADMIN_GROUP]) {
    const page = group.pages.find((p) => p.href === href);
    if (page) return page;
  }
  throw new Error(`No page registered for ${href}`);
}
