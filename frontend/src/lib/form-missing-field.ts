import { toast } from "@/hooks/use-toast"

export type MissingField = {
  id: string
  label: string
  title?: string
  message?: string
}

export function focusMissingField(id: string): void {
  const openCollapsedAncestors = (node: Element | null) => {
    let current: Element | null = node
    while (current) {
      if (
        current.getAttribute("data-slot") === "collapsible" &&
        current.getAttribute("data-state") === "closed"
      ) {
        const trigger = current.querySelector(
          '[data-slot="collapsible-trigger"]'
        ) as HTMLElement | null
        trigger?.click()
      }
      current = current.parentElement
    }
  }

  const el = document.getElementById(id)
  if (el) openCollapsedAncestors(el)

  window.setTimeout(() => {
    const target = document.getElementById(id)
    if (!target) return
    target.scrollIntoView({ behavior: "smooth", block: "center" })
    if (target instanceof HTMLElement) {
      target.focus({ preventScroll: true })
    }
  }, 120)
}

export function reportMissingField(field: MissingField): void {
  focusMissingField(field.id)
  toast({
    title: field.title ?? `${field.label} is required`,
    description: field.message ?? `Please fill in ${field.label} to continue.`,
    variant: "destructive",
  })
}

export function firstMissingField(
  checks: Array<{ id: string; label: string; missing: boolean; title?: string; message?: string }>
): MissingField | null {
  const hit = checks.find((c) => c.missing)
  if (!hit) return null
  return { id: hit.id, label: hit.label, title: hit.title, message: hit.message }
}
