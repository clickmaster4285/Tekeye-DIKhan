import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowLeft, BookOpen, FileText, Link2 } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DestructionRecordsPanel } from "@/components/warehouse/destruction-records-panel"
import { ROUTES, getDetentionMemoDetailPath } from "@/routes/config"
import { fetchDepositAccountById, type DepositAccountRow } from "@/lib/deposit-account-api"

function DetailRow({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="grid grid-cols-[minmax(0,190px)_1fr] gap-2 py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value?.trim() ? value : "—"}</span>
    </div>
  )
}

function formatIso(dt?: string): string {
  if (!dt?.trim()) return "—"
  const d = new Date(dt)
  if (Number.isNaN(d.getTime())) return dt
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

export default function DepositAccountRegisterDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [row, setRow] = useState<DepositAccountRow | null | undefined>(undefined)

  useEffect(() => {
    if (!id) {
      setRow(null)
      return
    }
    let cancelled = false
    fetchDepositAccountById(id)
      .then((data) => {
        if (!cancelled) setRow(data)
      })
      .catch(() => {
        if (!cancelled) setRow(null)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (!id) {
    return (
      <ModulePageLayout title="Deposit not found" description="Missing record id." breadcrumbs={[{ label: "WMS" }, { label: "Detentions" }, { label: "Deposit Account Register", href: ROUTES.DEPOSIT_ACCOUNT_REGISTER }]}>
        <Button asChild variant="outline"><Link to={ROUTES.DEPOSIT_ACCOUNT_REGISTER}>Back to register</Link></Button>
      </ModulePageLayout>
    )
  }

  if (row === undefined) {
    return (
      <ModulePageLayout
        title="Deposit Account"
        description="Loading…"
        breadcrumbs={[
          { label: "WMS" },
          { label: "Detentions" },
          { label: "Deposit Account Register", href: ROUTES.DEPOSIT_ACCOUNT_REGISTER },
          { label: "View" },
        ]}
      >
        <Card>
          <CardContent className="pt-6"><p className="text-sm text-muted-foreground">Loading deposit entry…</p></CardContent>
        </Card>
      </ModulePageLayout>
    )
  }

  if (!row) {
    return (
      <ModulePageLayout
        title="Deposit not found"
        description="This deposit entry may have been removed."
        breadcrumbs={[
          { label: "WMS" },
          { label: "Detentions" },
          { label: "Deposit Account Register", href: ROUTES.DEPOSIT_ACCOUNT_REGISTER },
          { label: "View" },
        ]}
      >
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p className="text-muted-foreground text-sm">The requested deposit record does not exist or the API returned an error.</p>
            <Button asChild variant="outline">
              <Link to={ROUTES.DEPOSIT_ACCOUNT_REGISTER}>
                <ArrowLeft className="h-4 w-4 mr-2" />Back to Deposit Account Register
              </Link>
            </Button>
          </CardContent>
        </Card>
      </ModulePageLayout>
    )
  }

  const titleRef = row.caseSeizureRef?.trim() || row.treasuryChallanNo?.trim() || row.id.slice(0, 8)

  return (
    <ModulePageLayout
      title={`Deposit: ${titleRef}`}
      description="Pakistan Customs deposit account entry — treasury challan, case reference, FIR, customs station and status."
      breadcrumbs={[
        { label: "WMS" },
        { label: "Detentions" },
        { label: "Deposit Account Register", href: ROUTES.DEPOSIT_ACCOUNT_REGISTER },
        { label: titleRef },
      ]}
    >
      <div className="grid gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <BookOpen className="h-5 w-5" />
                Deposit entry
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Record ID: <span className="font-mono text-xs">{row.id}</span></p>
            </div>
            <Badge variant={row.status === "Posted" ? "default" : row.status === "Pending" ? "secondary" : "outline"}>
              {row.status || "—"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-6">
            <Card className="border-dashed bg-muted/20">
              <CardContent className="pt-5 space-y-0">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Treasury & case
                </h4>
                <DetailRow label="Treasury challan no." value={row.treasuryChallanNo} />
                <DetailRow label="Deposit type" value={row.depositType} />
                <DetailRow label="Case / seizure ref" value={row.caseSeizureRef} />
                <DetailRow label="FIR no." value={row.firNo} />
                <DetailRow label="Customs station" value={row.customsStation} />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5 space-y-0">
                <h4 className="text-sm font-semibold mb-3">Value & banking</h4>
                <DetailRow label="Average value / amount (PKR)" value={row.amount} />
                <DetailRow label="Deposit date" value={row.depositDate} />
                <DetailRow label="Bank / treasury name" value={row.bankTreasuryName} />
              </CardContent>
            </Card>

            {row.remarks?.trim() && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Remarks</CardTitle></CardHeader>
                <CardContent className="rounded-lg border p-4">
                  <p className="text-sm whitespace-pre-wrap">{row.remarks}</p>
                </CardContent>
              </Card>
            )}

            {(row.detentionMemoId?.trim()) && (
              <Card className="border-primary/25 bg-primary/5">
                <CardContent className="pt-5">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    Linked detention memo
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    This deposit row was created from (or tied to) a detention memo. Open the memo for full detention details.
                  </p>
                  <div className="flex flex-wrap gap-3 items-center">
                    {row.linkedMemoCaseNo?.trim() && (
                      <span className="text-sm">Case no.: <strong>{row.linkedMemoCaseNo}</strong></span>
                    )}
                    <Button asChild variant="default" size="sm">
                      <Link to={getDetentionMemoDetailPath(row.detentionMemoId!)}>Open detention memo</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="pt-5 space-y-0">
                <h4 className="text-sm font-semibold mb-3">Audit</h4>
                <DetailRow label="Created (server)" value={formatIso(row.createdAt)} />
                <DetailRow label="Last updated" value={formatIso(row.updatedAt)} />
              </CardContent>
            </Card>

            <DestructionRecordsPanel
              detentionMemoId={row.detentionMemoId}
              caseNo={row.caseSeizureRef || row.linkedMemoCaseNo}
              title="Linked destruction records"
              description="Destruction sessions for the linked detention case — deposit status may update to Destructed after warehouse destruction."
            />

            <Button asChild variant="outline">
              <Link to={ROUTES.DEPOSIT_ACCOUNT_REGISTER}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to register
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </ModulePageLayout>
  )
}
