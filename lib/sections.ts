// Navigation and page descriptions for the whole app.

export type SectionKey = 'quality_analyst' | 'curriculum' | 'mentor';

export type IconName =
  | 'home' | 'grid' | 'chart' | 'list' | 'person' | 'bookmark' | 'clock'
  | 'cap' | 'chat' | 'users' | 'login';

export type PageInfo = {
  href: string;
  label: string;
  title: string;
  subtitle: string;
  icon: IconName;
  phase: number;
  planned: string[];
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
        phase: 2,
        planned: [
          'Total records and monthly / quarterly trend',
          'Validity split with a source filter',
          'Category and complaint-type breakdowns for Instructor and Course cases',
        ],
      },
      {
        href: '/quality-analyst/survey-insights',
        label: 'Survey insights',
        title: 'Survey insights',
        subtitle: 'Low survey scores by month, type and reason.',
        icon: 'chart',
        phase: 2,
        planned: [
          'Surveys per month by type',
          'Reason type by month and by survey type',
          'Rating distribution and totals by type, with a date-range filter',
        ],
      },
      {
        href: '/quality-analyst/case-log',
        label: 'Case log',
        title: 'Case log',
        subtitle: 'Every Quality Analyst case in one searchable table.',
        icon: 'list',
        phase: 2,
        planned: [
          'Filters: Source (multi-select), Analyst, Category, Validity, date range, search',
          'Add case: pick a source, then fill in the new record',
          'Edit and delete (with confirmation) for Quality Analyst admins',
        ],
      },
      {
        href: '/quality-analyst/instructors',
        label: 'Instructor view',
        title: 'Instructor view',
        subtitle: 'Complaints and low scores grouped by instructor.',
        icon: 'person',
        phase: 2,
        planned: ['Most common issues per instructor', 'Validity split for the selected instructor'],
      },
      {
        href: '/quality-analyst/courses',
        label: 'Course view',
        title: 'Course view',
        subtitle: 'Complaints and low scores grouped by course.',
        icon: 'bookmark',
        phase: 2,
        planned: ['Most common issues per course', 'Validity split for the selected course'],
      },
      {
        href: '/quality-analyst/follow-up',
        label: 'Follow-up',
        title: 'Follow-up view',
        subtitle: 'Customers still waiting on contact or action.',
        icon: 'clock',
        phase: 2,
        planned: [
          'Unreached customers and urgent-action cases',
          'Records with no case link',
          'Reach rate by channel (email, SMS, call)',
        ],
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
        phase: 3,
        planned: [
          'Total cases and trend by month',
          'Category and material breakdown',
          'Average resolution time and 5-year trend',
        ],
      },
      {
        href: '/curriculum/case-log',
        label: 'Case log',
        title: 'Curriculum case log',
        subtitle: 'Customer Cases about course content.',
        icon: 'list',
        phase: 3,
        planned: ['Searchable table of Customer Cases', 'Add, edit and delete for Curriculum admins'],
      },
      {
        href: '/curriculum/instructor-requests',
        label: 'Instructor requests',
        title: 'Instructor requests',
        subtitle: 'Content-error feedback from instructors and mentors.',
        icon: 'chat',
        phase: 3,
        planned: ['One row per request, with status and ticket manager tracking'],
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
        phase: 3,
        planned: [
          'Total, closed, in-progress and valid complaints',
          'By year, quarter, complaint type and mentor',
          'Validity split',
        ],
      },
      {
        href: '/mentor/case-log',
        label: 'Case log',
        title: 'Mentor case log',
        subtitle: 'Every mentor complaint in one table.',
        icon: 'list',
        phase: 3,
        planned: [
          'Filters: Mentor, Complaint type, Sub type, Status, Validity',
          'Add, edit and delete for Mentor admins',
        ],
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
      phase: 4,
      planned: [
        'Filters: Section and Status (multi-select), Role, search',
        'Add, edit, deactivate (with note) and delete users',
        'Set a new password for any user; export CSV',
      ],
    },
    {
      href: '/admin/activity-log',
      label: 'Activity Log',
      title: 'Activity Log',
      subtitle: 'Every change to cases and user access.',
      icon: 'clock',
      phase: 4,
      planned: [
        'Tabs: All / Quality Analyst / Curriculum / Mentor',
        'Filters: user, action type (multi-select), date range, search',
        'Export CSV',
      ],
    },
    {
      href: '/admin/login-history',
      label: 'Login History',
      title: 'Login History',
      subtitle: 'Every successful sign-in.',
      icon: 'login',
      phase: 4,
      planned: ['When and who', 'Filters: user, date range', 'Export CSV'],
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
