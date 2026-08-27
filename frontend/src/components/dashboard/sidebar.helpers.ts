import type { NavGroup, NavItem } from "@/routes/config"

export type SidebarNode = NavItem | NavGroup

export function isNavGroup(node: SidebarNode): node is NavGroup {
  return "children" in node
}

export function hasActiveDescendant(group: NavGroup, pathname: string): boolean {
  if (group.overviewHref === pathname) return true
  return group.children.some((child) =>
    isNavGroup(child) ? hasActiveDescendant(child, pathname) : child.href === pathname
  )
}

export function getNodeKey(node: SidebarNode): string {
  return isNavGroup(node) ? `group:${node.label}` : `item:${node.href}`
}
