import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchNotifications, notifyHost, type NotificationRecord } from "@/lib/vms-api"
import { fetchVisitors } from "@/lib/visitor-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { MessageSquare, Loader2, Send } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function formatDate(s: string) {
  try {
    return new Date(s).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
  } catch {
    return s
  }
}

export default function CommunicationPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [visitorId, setVisitorId] = useState("")
  const [recipient, setRecipient] = useState("")

  const { data: notifications, isLoading } = useQuery({
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
      queryClient.invalidateQueries({ queryKey: ["visitor", visitorId] })
      toast({ title: "Host notified", description: "Notification sent and logged." })
      setVisitorId("")
      setRecipient("")
    },
    onError: (e) => {
      toast({ title: "Failed to notify host", description: e.message, variant: "destructive" })
    },
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
    <div className="w-full mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#3b82f6]/10 text-[#3b82f6]">
          <MessageSquare className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Communication</h1>
          <p className="text-sm text-muted-foreground">
            Notify host of visitor arrival, reminders, and alerts.
          </p>
        </div>
      </div>

      <form onSubmit={handleNotify} className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div>
          <Label>Visitor</Label>
          <Select value={visitorId} onValueChange={setVisitorId}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select visitor to notify host" />
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
        <div>
          <Label htmlFor="recipient">Recipient (optional – uses visitor email/host if blank)</Label>
          <Input
            id="recipient"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="Email or identifier"
            className="mt-1"
          />
        </div>
        <Button type="submit" disabled={notifyMutation.isPending}>
          {notifyMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Notify host (arrival)
        </Button>
      </form>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border font-medium text-foreground">Notification log</div>
        {isLoading ? (
          <div className="p-6 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !notifications?.length ? (
          <div className="p-6 text-center text-muted-foreground text-sm">No notifications yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {(notifications as NotificationRecord[]).map((n) => (
              <li key={n.id} className="p-4">
                <p className="font-medium text-foreground">{n.notification_type.replace(/_/g, " ")}</p>
                <p className="text-sm text-muted-foreground">
                  {n.visitor_name} → {n.recipient || "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{formatDate(n.sent_at)} · {n.success ? "Sent" : "Failed"}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
