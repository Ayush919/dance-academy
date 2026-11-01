'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { ExternalLink } from 'lucide-react'
import { NAV } from './nav-config'

export function isActive(pathname: string, href: string) {
  return href === '/admin'
    ? pathname === '/admin'
    : pathname === href || pathname.startsWith(`${href}/`)
}

/** Dark, collapsible admin sidebar. `allowed` comes from the server's permission check. */
export function AppSidebar({ allowed }: { allowed: string[] }) {
  const pathname = usePathname()
  const groups = NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => allowed.includes(i.id)),
  })).filter((g) => g.items.length > 0)

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="h-14 justify-center px-3">
        <Link
          href="/admin"
          className="flex items-baseline gap-2 overflow-hidden"
          aria-label="Admin home"
        >
          <span className="type-display text-sidebar-accent-foreground text-xl tracking-[0.02em]">
            R<span className="group-data-[collapsible=icon]:hidden">emo</span>
            <span className="text-sidebar-primary">.</span>
          </span>
          <span className="text-sidebar-foreground/60 truncate text-[0.6rem] font-medium tracking-[0.28em] uppercase group-data-[collapsible=icon]:hidden">
            Studio
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-sidebar-foreground/50">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href)
                  return (
                    <SidebarMenuItem key={item.id}>
                      {item.available ? (
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={item.title}
                          className="data-[active=true]:shadow-[inset_2px_0_0_var(--sidebar-primary)]"
                        >
                          <Link href={item.href} aria-current={active ? 'page' : undefined}>
                            <item.icon />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      ) : (
                        <>
                          <SidebarMenuButton
                            aria-disabled
                            tooltip={`${item.title} — coming soon`}
                            className="hover:text-sidebar-foreground cursor-default opacity-45 hover:bg-transparent"
                          >
                            <item.icon />
                            <span>{item.title}</span>
                          </SidebarMenuButton>
                          <SidebarMenuBadge className="text-sidebar-foreground/45 text-[0.6rem] tracking-wider uppercase">
                            Soon
                          </SidebarMenuBadge>
                        </>
                      )}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="View website">
              <Link href="/" target="_blank">
                <ExternalLink />
                <span>View website</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
