'use client';

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface Step4Props {
  formData: {
    disclaimerAccepted: boolean;
    termsAccepted: boolean;
    previousVisitReference: string;
  };
  updateFormData: (data: Partial<Step4Props["formData"]>) => void;
}

export function Step4Consent({ formData, updateFormData }: Step4Props) {
  return (
    <div className="space-y-6">
      <h3 className="text-base font-medium text-foreground">
        Security & Consent
      </h3>

      <div className="space-y-6">
        {/* Disclaimer */}
        <div className="flex items-start gap-3 p-4 rounded-lg border border-border bg-[#f8fafc]">
          <Checkbox
            id="disclaimer"
            checked={formData.disclaimerAccepted}
            onCheckedChange={(checked) =>
              updateFormData({ disclaimerAccepted: checked as boolean })
            }
            className="mt-1"
          />
          <div className="flex-1">
            <Label
              htmlFor="disclaimer"
              className="text-sm font-medium text-foreground cursor-pointer"
            >
              Disclaimer:
            </Label>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              I consent to the collection, processing, and storage of my
              personal data, including but not limited to identification
              documents, photographs, biometric information, and contact details
              for visitor management purposes. I understand that this
              information will be used for security verification, access
              control, and record keeping in accordance with applicable data
              protection regulations. I acknowledge that surveillance systems
              (CCTV) may be in operation and that my image may be recorded during
              my visit. I also understand that I may be retained for the period
              required by law and organizational policies, and will be protected
              against unauthorized access or disclosure.
            </p>
          </div>
        </div>

        {/* Terms and Conditions */}
        <div className="flex items-start gap-3 p-4 rounded-lg border border-border bg-[#f8fafc]">
          <Checkbox
            id="terms"
            checked={formData.termsAccepted}
            onCheckedChange={(checked) =>
              updateFormData({ termsAccepted: checked as boolean })
            }
            className="mt-1"
          />
          <div className="flex-1">
            <Label
              htmlFor="terms"
              className="text-sm font-medium text-foreground cursor-pointer"
            >
              Terms and Conditions:
            </Label>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              I hereby declare and acknowledge that all information provided above is accurate and complete to the best of my knowledge. I understand
              that this pre-registration is subject to approval by the relevant authorities, and I agree to comply with all security protocols and visitor policies during
              my visit as per the terms.
            </p>
          </div>
        </div>

        {/* Previous Visit Reference */}
        <div className="space-y-2 max-w-md">
          <Label
            htmlFor="previousVisitReference"
            className="text-sm text-muted-foreground"
          >
            Previous Visit Reference No.
          </Label>
          <Input
            id="previousVisitReference"
            placeholder="Enter if any"
            value={formData.previousVisitReference}
            onChange={(e) =>
              updateFormData({ previousVisitReference: e.target.value })
            }
            className="h-11"
          />
        </div>
      </div>
    </div>
  );
}
