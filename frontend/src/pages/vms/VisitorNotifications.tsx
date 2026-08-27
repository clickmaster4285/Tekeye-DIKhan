import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchNotifications, notifyHost, type NotificationRecord } from "@/lib/vms-api"
import { fetchVisitors } from "@/lib/visitor-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Link } from "react-router-dom"
import { Bell, Loader2, Send } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

function formatDate(s: string) {
  if (!s) return "—"
  try {
    return new Date(s).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
  } catch {
    return s
  }
}

export default function VisitorNotifications() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [visitorId, setVisitorId] = useState("")
  const [recipient, setRecipient] = useState("")

  const { data: notifications, isLoading: notifLoading, isError, error } = useQuery({
    queryKey: ["vms", "notifications"],
    queryFn: () => fetchNotifications(),
  })
  const { data: visitors } = useQuery({
    queryKey: ["visitors"],
    queryFn: fetchVisitors,
  })

  const notifyMutation = useMutation({
    mutationFn: () => notifyHost(Number(visitorId), recipient.trim() || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vms", "notifications"] })
      setVisitorId("")
      setRecipient("")
      toast({ title: "Host notified", description: "Notification sent." })
    },
    onError: (e) => toast({ title: "Failed to notify host", description: e.message, variant: "destructive" }),
  })

  const handleNotify = (e: React.FormEvent) => {
    e.preventDefault()
    if (!visitorId) {
      toast({ title: "Select a visitor", variant: "destructive" })
      return
    }
    notifyMutation.mutate()
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#3b82f6]/10 text-[#3b82f6]">
          <Bell className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Visitor Notifications</h1>
          <p className="text-sm text-muted-foreground">
            Manage notifications for hosts about visitor arrivals and updates. Send host notifications.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="font-medium text-foreground mb-4">Notify host</h2>
        <form onSubmit={handleNotify} className="flex flex-wrap gap-4 items-end">
          <div className="min-w-[220px]">
            <Label>Visitor</Label>
            <Select value={visitorId} onValueChange={setVisitorId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select visitor" />
              </SelectTrigger>
              <SelectContent>
                {visitors?.map((v) => (
                  <SelectItem key={v.id} value={String(v.id)}>
                    {v.full_name} (ID {v.id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[200px]">
            <Label htmlFor="recipient">Recipient (optional)</Label>
            <Input
              id="recipient"
              placeholder="Email or phone"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="mt-1"
            />
          </div>
          <Button type="submit" disabled={notifyMutation.isPending}>
            {notifyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
            Send notification
          </Button>
        </form>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border font-medium text-foreground">
          Notification history
        </div>
        {notifLoading && (
          <div className="p-8 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
        {isError && (
          <div className="p-6 text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load notifications."}
          </div>
        )}
        {notifications && notifications.length === 0 && !notifLoading && (
          <div className="p-8 text-center text-muted-foreground text-sm">No notifications yet.</div>
        )}
        {notifications && notifications.length > 0 && (
          <ul className="divide-y divide-border">
            {(notifications as NotificationRecord[]).map((n) => (
              <li key={n.id} className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${n.success ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}>
                    <Bell className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{n.notification_type}</p>
                    <p className="text-sm text-muted-foreground">
                      Visitor: {n.visitor_name ?? n.visitor} · To: {n.recipient || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(n.sent_at)} {n.success ? "· Sent" : "· Failed"}</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/visitors/${n.visitor}`}>View visitor</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
