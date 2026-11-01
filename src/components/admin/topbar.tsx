'use client'

import { Fragment, useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Bell, Building2, Check, ChevronsUpDown, ExternalLink, LogOut, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Kbd } from '@/components/ui/kbd'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { EmptyState } from '@/components/states/empty-state'
import { authClient } from '@/lib/auth-client'
import { hardNavigate } from '@/lib/navigation'
import { setActiveBranch } from '@/server/actions/workspace'
import type { BranchOption } from '@/server/services/branches'
import { isActive } from './app-sidebar'
import { useCrumbLabels } from './crumb-label'
import { NAV, NAV_ITEMS, ROLE_LABELS } from './nav-config'

export interface TopbarProps {
  user: { name: string; email: string; role: string }
  allowed: string[]
  branches: BranchOption[]
  activeBranchId: string
  /** Academy-wide roles can pick "All branches". */
  canSeeAll: boolean
}

export function Topbar(props: TopbarProps) {
  return (
    <header className="bg-background/85 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b px-3 backdrop-blur sm:px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-1 hidden h-5 sm:block" />
      <Breadcrumbs />
      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <CommandMenu allowed={props.allowed} branches={props.branches} />
        <BranchSwitcher {...props} />
        <Notifications />
        <UserMenu user={props.user} />
      </div>
    </header>
  )
}

function Breadcrumbs() {
  const pathname = usePathname()
  const names = useCrumbLabels()
  const current = [...NAV_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((i) => isActive(pathname, i.href))
  const rest = current ? pathname.slice(current.href.length).split('/').filter(Boolean) : []
  const crumbs = [
    ...(current && current.href !== '/admin'
      ? [{ label: current.title, href: current.href, slug: false }]
      : []),
    ...rest.map((seg, i) => ({
      slug: !names.has(seg),
      label:
        names.get(seg) ??
        (/^[a-f0-9]{24}$/.test(seg) ? 'Details' : decodeURIComponent(seg).replace(/-/g, ' ')),
      href: `${current?.href}/${rest.slice(0, i + 1).join('/')}`,
    })),
  ]

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        <BreadcrumbItem className={crumbs.length ? 'hidden sm:inline-flex' : ''}>
          {crumbs.length ? (
            <BreadcrumbLink asChild>
              <Link href="/admin">Dashboard</Link>
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage>Dashboard</BreadcrumbPage>
          )}
        </BreadcrumbItem>
        {crumbs.map((c, i) => (
          <Fragment key={c.href}>
            <BreadcrumbSeparator className="hidden sm:block" />
            <BreadcrumbItem className="min-w-0">
              {i === crumbs.length - 1 ? (
                <BreadcrumbPage className={c.slug ? 'truncate capitalize' : 'truncate'}>
                  {c.label}
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild className={c.slug ? 'capitalize' : undefined}>
                  <Link href={c.href}>{c.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

function CommandMenu({ allowed, branches }: { allowed: string[]; branches: BranchOption[] }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const go = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  return (
    <>
      <Button
        variant="outline"
        className="text-muted-foreground h-8 gap-2 max-sm:size-8 max-sm:p-0 sm:w-56 sm:justify-start"
        onClick={() => setOpen(true)}
        aria-label="Search"
      >
        <Search />
        <span className="hidden sm:inline">Search…</span>
        <Kbd className="ml-auto hidden sm:inline-flex">⌘K</Kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search"
        description="Jump to any page or branch"
      >
        <Command>
          <CommandInput placeholder="Search pages and branches…" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            {NAV.map((group) => {
              const items = group.items.filter((i) => allowed.includes(i.id) && i.available)
              if (!items.length) return null
              return (
                <CommandGroup key={group.label} heading={group.label}>
                  {items.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={`${item.title} ${item.keywords?.join(' ') ?? ''}`}
                      onSelect={() => go(item.href)}
                    >
                      <item.icon /> {item.title}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )
            })}
            {branches.length > 0 && allowed.includes('branches') && (
              <CommandGroup heading="Branches">
                {branches.map((b) => (
                  <CommandItem
                    key={b.id}
                    value={`branch ${b.name}`}
                    onSelect={() => go(`/admin/branches?q=${encodeURIComponent(b.name)}`)}
                  >
                    <Building2 /> {b.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}

function BranchSwitcher({ branches, activeBranchId, canSeeAll }: TopbarProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  if (branches.length === 0) return null
  const options = [...(canSeeAll ? [{ id: 'all', name: 'All branches' }] : []), ...branches]
  const active = options.find((o) => o.id === activeBranchId) ?? options[0]!
  if (options.length === 1) {
    return (
      <span className="text-muted-foreground hidden items-center gap-1.5 px-2 text-sm md:inline-flex">
        <Building2 className="size-4" /> {active.name}
      </span>
    )
  }

  const choose = (id: string) =>
    startTransition(async () => {
      const res = await setActiveBranch({ branchId: id })
      if (res.ok) router.refresh()
      else toast.error(res.error.message)
    })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-8 gap-1.5 px-2"
          disabled={pending}
          aria-label="Switch branch"
        >
          <Building2 />
          <span className="hidden max-w-36 truncate md:inline">{active.name}</span>
          <ChevronsUpDown className="size-3.5 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Working in</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((o) => (
          <DropdownMenuItem key={o.id} onSelect={() => choose(o.id)}>
            {o.name}
            {o.id === active.id && <Check className="ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Notifications() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3 text-sm font-medium">Notifications</div>
        <EmptyState
          icon={Bell}
          title="You’re all caught up"
          description="Follow-ups, new bookings and payment alerts will appear here."
          className="py-8"
        />
      </PopoverContent>
    </Popover>
  )
}

function UserMenu({ user }: { user: TopbarProps['user'] }) {
  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const signOut = async () => {
    await authClient.signOut()
    hardNavigate('/login')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
          <Avatar className="size-8">
            <AvatarFallback className="bg-ink text-ivory text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="truncate font-medium">{user.name}</div>
          <div className="text-muted-foreground truncate text-xs">{user.email}</div>
          <div className="text-muted-foreground mt-1 text-xs">
            {ROLE_LABELS[user.role] ?? user.role}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/" target="_blank">
            <ExternalLink /> View website
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
