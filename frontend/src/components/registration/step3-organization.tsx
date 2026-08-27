'use client';

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface Step3Props {
  formData: {
    organizationName: string;
    organizationType: string;
    ntnRegistrationNo: string;
    designation: string;
    officeAddress: string;
  };
  updateFormData: (data: Partial<Step3Props["formData"]>) => void;
}

export function Step3Organization({ formData, updateFormData }: Step3Props) {
  return (
    <div className="space-y-6">
      <h3 className="text-base font-medium text-foreground">
        Organization & Information
      </h3>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label
            htmlFor="organizationName"
            className="text-sm text-muted-foreground"
          >
            Organization Name
          </Label>
          <Input
            id="organizationName"
            placeholder="Enter organization name"
            value={formData.organizationName}
            onChange={(e) =>
              updateFormData({ organizationName: e.target.value })
            }
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="organizationType"
            className="text-sm text-muted-foreground"
          >
            Organization Type
          </Label>
          <Select
            value={formData.organizationType}
            onValueChange={(value) =>
              updateFormData({ organizationType: value })
            }
          >
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Select the type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="private">Private Limited</SelectItem>
              <SelectItem value="public">Public Limited</SelectItem>
              <SelectItem value="government">Government</SelectItem>
              <SelectItem value="ngo">NGO</SelectItem>
              <SelectItem value="partnership">Partnership</SelectItem>
              <SelectItem value="sole">Sole Proprietorship</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="ntnRegistrationNo"
            className="text-sm text-muted-foreground"
          >
            NTN / Registration No.
          </Label>
          <Input
            id="ntnRegistrationNo"
            placeholder="Enter the number"
            value={formData.ntnRegistrationNo}
            onChange={(e) =>
              updateFormData({ ntnRegistrationNo: e.target.value })
            }
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">
            Business registration - optional
          </p>
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="designation"
            className="text-sm text-muted-foreground"
          >
            Designation
          </Label>
          <Input
            id="designation"
            placeholder="Enter own company/org"
            value={formData.designation}
            onChange={(e) => updateFormData({ designation: e.target.value })}
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">
            Mandatory for Relevant Nationals
          </p>
        </div>

        <div className="col-span-2 space-y-2">
          <Label
            htmlFor="officeAddress"
            className="text-sm text-muted-foreground"
          >
            Office Address
          </Label>
          <Textarea
            id="officeAddress"
            placeholder="e.g. Office #, Building Name, Area, City"
            value={formData.officeAddress}
            onChange={(e) => updateFormData({ officeAddress: e.target.value })}
            className="min-h-[80px] resize-none"
          />
          <p className="text-xs text-muted-foreground">Organization Address</p>
        </div>
      </div>
    </div>
  );
}
