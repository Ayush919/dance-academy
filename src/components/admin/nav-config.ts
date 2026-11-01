import {
  BadgeIndianRupee,
  Building2,
  CalendarDays,
  CalendarRange,
  ChartColumn,
  ClipboardCheck,
  FileClock,
  FileSignature,
  GalleryHorizontalEnd,
  Globe,
  GraduationCap,
  House,
  Images,
  LayoutDashboard,
  Layers,
  Megaphone,
  MessageSquareQuote,
  MicVocal,
  ReceiptIndianRupee,
  Settings,
  Sparkles,
  Ticket,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { Permission } from '@/server/rbac/policy'

export interface NavItem {
  id: string
  title: string
  href: string
  icon: LucideIcon
  /** Shown only to roles holding this permission (checked on the server). */
  permission?: Permission
  /** False while the module is still being built; shown as "Soon" and not clickable. */
  available: boolean
  keywords?: string[]
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

/** Admin information architecture. Order here is the order in the sidebar and ⌘K. */
export const NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        id: 'dashboard',
        title: 'Dashboard',
        href: '/admin',
        icon: LayoutDashboard,
        available: true,
      },
    ],
  },
  {
    label: 'Academy',
    items: [
      {
        id: 'branches',
        title: 'Branches & rooms',
        href: '/admin/branches',
        icon: Building2,
        permission: 'branches.read',
        available: true,
        keywords: ['locations', 'studios', 'facilities'],
      },
      {
        id: 'programs',
        title: 'Programs',
        href: '/admin/programs',
        icon: Sparkles,
        permission: 'programs.read',
        available: true,
        keywords: ['courses', 'styles'],
      },
      {
        id: 'feeplans',
        title: 'Fee plans',
        href: '/admin/fee-plans',
        icon: BadgeIndianRupee,
        permission: 'feeplans.read',
        available: true,
        keywords: ['prices', 'pricing', 'fees'],
      },
      {
        id: 'instructors',
        title: 'Instructors',
        href: '/admin/instructors',
        icon: MicVocal,
        permission: 'instructors.read',
        available: true,
        keywords: ['trainers', 'teachers', 'availability'],
      },
      {
        id: 'batches',
        title: 'Batches',
        href: '/admin/batches',
        icon: Layers,
        permission: 'batches.read',
        available: true,
        keywords: ['groups', 'classes', 'schedule'],
      },
      {
        id: 'timetable',
        title: 'Timetable',
        href: '/admin/timetable',
        icon: CalendarRange,
        permission: 'sessions.read',
        available: true,
        keywords: ['schedule', 'calendar', 'week', 'classes'],
      },
    ],
  },
  {
    label: 'People',
    items: [
      {
        id: 'students',
        title: 'Students',
        href: '/admin/students',
        icon: Users,
        permission: 'students.read',
        available: true,
        keywords: ['dancers', 'children', 'roster'],
      },
      {
        id: 'families',
        title: 'Families',
        href: '/admin/families',
        icon: House,
        permission: 'households.read',
        available: true,
        keywords: ['households', 'parents', 'guardians', 'billing'],
      },
      {
        id: 'enrollments',
        title: 'Enrolments',
        href: '/admin/enrollments',
        icon: GraduationCap,
        permission: 'enrollments.read',
        available: true,
        keywords: ['waitlist'],
      },
      {
        id: 'consents',
        title: 'Consent forms',
        href: '/admin/consents',
        icon: FileSignature,
        permission: 'consents.read',
        available: true,
        keywords: ['waiver', 'photo release', 'terms', 'signatures'],
      },
      {
        id: 'attendance',
        title: 'Attendance',
        href: '/admin/attendance',
        icon: ClipboardCheck,
        permission: 'attendance.read',
        available: false,
      },
    ],
  },
  {
    label: 'Growth',
    items: [
      {
        id: 'leads',
        title: 'Leads & CRM',
        href: '/admin/leads',
        icon: Megaphone,
        permission: 'leads.read',
        available: false,
        keywords: ['inquiries', 'follow-ups'],
      },
      {
        id: 'trials',
        title: 'Trial bookings',
        href: '/admin/trials',
        icon: CalendarDays,
        permission: 'trials.read',
        available: false,
      },
      {
        id: 'events',
        title: 'Events & workshops',
        href: '/admin/events',
        icon: Ticket,
        permission: 'events.read',
        available: false,
      },
    ],
  },
  {
    label: 'Finance',
    items: [
      {
        id: 'invoices',
        title: 'Fees & invoices',
        href: '/admin/invoices',
        icon: ReceiptIndianRupee,
        permission: 'invoices.read',
        available: false,
        keywords: ['dues', 'outstanding'],
      },
      {
        id: 'payments',
        title: 'Payments & refunds',
        href: '/admin/payments',
        icon: Wallet,
        permission: 'payments.read',
        available: false,
        keywords: ['receipts', 'collections'],
      },
    ],
  },
  {
    label: 'Website',
    items: [
      {
        id: 'cms',
        title: 'Website',
        href: '/admin/website',
        icon: Globe,
        permission: 'cms.read',
        available: true,
        keywords: ['cms', 'pages', 'homepage', 'seo'],
      },
      {
        id: 'media',
        title: 'Media library',
        href: '/admin/media',
        icon: Images,
        permission: 'media.read',
        available: true,
        keywords: ['gallery', 'photos', 'videos'],
      },
      {
        id: 'gallery',
        title: 'Gallery',
        href: '/admin/website/gallery',
        icon: GalleryHorizontalEnd,
        permission: 'cms.read',
        available: true,
        keywords: ['photos', 'videos', 'performances'],
      },
      {
        id: 'testimonials',
        title: 'Testimonials',
        href: '/admin/website/testimonials',
        icon: MessageSquareQuote,
        permission: 'testimonials.moderate',
        available: true,
        keywords: ['reviews', 'moderation', 'stories'],
      },
    ],
  },
  {
    label: 'Insights',
    items: [
      {
        id: 'reports',
        title: 'Reports',
        href: '/admin/reports',
        icon: ChartColumn,
        permission: 'reports.read',
        available: false,
        keywords: ['analytics', 'revenue'],
      },
    ],
  },
  {
    label: 'Settings',
    items: [
      {
        id: 'settings',
        title: 'Academy settings',
        href: '/admin/settings',
        icon: Settings,
        permission: 'academy.settings.read',
        available: false,
        keywords: ['policies', 'currency', 'timezone'],
      },
      {
        id: 'users',
        title: 'Staff & roles',
        href: '/admin/users',
        icon: UserCog,
        permission: 'users.read',
        available: false,
        keywords: ['team', 'permissions'],
      },
      {
        id: 'audit',
        title: 'Audit log',
        href: '/admin/audit',
        icon: FileClock,
        permission: 'audit.read',
        available: false,
        keywords: ['history', 'activity'],
      },
    ],
  },
]

export const NAV_ITEMS = NAV.flatMap((g) => g.items)

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super admin',
  academy_admin: 'Academy admin',
  branch_manager: 'Branch manager',
  instructor: 'Instructor',
  receptionist: 'Front desk',
  guardian: 'Parent / guardian',
  student: 'Student',
}
