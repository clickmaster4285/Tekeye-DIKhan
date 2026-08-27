"use client"

import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface WalkInStep2Props {
  formData: {
    watchlistCheckStatus: string
    approverRequired: string
    temporaryAccessGranted: string
    guardRemarks: string
  }
  updateFormData: (data: Partial<WalkInStep2Props["formData"]>) => void
}

export function WalkInStep2Security({
  formData,
  updateFormData,
}: WalkInStep2Props) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">
        Quick Security Screening
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Watchlist Check Status */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            Watchlist Check Status
          </Label>
          <Select
            value={formData.watchlistCheckStatus}
            onValueChange={(value) =>
              updateFormData({ watchlistCheckStatus: value })
            }
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Clear" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="clear">Clear</SelectItem>
              <SelectItem value="flagged">Flagged</SelectItem>
              <SelectItem value="pending">Pending Review</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Approver Required */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            Approver Required
          </Label>
          <Select
            value={formData.approverRequired}
            onValueChange={(value) =>
              updateFormData({ approverRequired: value })
            }
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Yes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Temporary Access Granted */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            Temporary Access Granted
          </Label>
          <Select
            value={formData.temporaryAccessGranted}
            onValueChange={(value) =>
              updateFormData({ temporaryAccessGranted: value })
            }
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Yes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Guard Remarks */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">
          Guard Remarks
        </Label>
        <Textarea
          placeholder="Remarks"
          value={formData.guardRemarks}
          onChange={(e) => updateFormData({ guardRemarks: e.target.value })}
          className="bg-background min-h-[120px] resize-none"
        />
        <p className="text-sm text-muted-foreground">(Optional notes)</p>
      </div>
    </div>
  )
}
