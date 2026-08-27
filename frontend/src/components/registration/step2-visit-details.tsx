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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface Step2Props {
  formData: {
    visitPurpose: string;
    visitDescription: string;
    departmentToVisit: string;
    hostOfficerName: string;
    hostOfficerDesignation: string;
    preferredVisitDate: string;
    preferredTimeSlot: string;
    expectedDuration: string;
    preferredViewVisit: string;
  };
  updateFormData: (data: Partial<Step2Props["formData"]>) => void;
}

export function Step2VisitDetails({ formData, updateFormData }: Step2Props) {
  return (
    <div className="space-y-6">
      <h3 className="text-base font-medium text-foreground">Visit Details</h3>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label
            htmlFor="visitPurpose"
            className="text-sm text-muted-foreground"
          >
            Visit Purpose <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formData.visitPurpose}
            onValueChange={(value) => updateFormData({ visitPurpose: value })}
          >
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Select the purpose" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="meeting">Meeting</SelectItem>
              <SelectItem value="interview">Interview</SelectItem>
              <SelectItem value="delivery">Delivery</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="consultation">Consultation</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="visitDescription"
            className="text-sm text-muted-foreground"
          >
            Visit Description
          </Label>
          <Input
            id="visitDescription"
            placeholder="Brief reason for visit"
            value={formData.visitDescription}
            onChange={(e) =>
              updateFormData({ visitDescription: e.target.value })
            }
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="departmentToVisit"
            className="text-sm text-muted-foreground"
          >
            Department to Visit <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formData.departmentToVisit}
            onValueChange={(value) =>
              updateFormData({ departmentToVisit: value })
            }
          >
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Select the department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hr">Human Resources</SelectItem>
              <SelectItem value="it">Information Technology</SelectItem>
              <SelectItem value="finance">Finance</SelectItem>
              <SelectItem value="operations">Operations</SelectItem>
              <SelectItem value="marketing">Marketing</SelectItem>
              <SelectItem value="admin">Administration</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="hostOfficerName"
            className="text-sm text-muted-foreground"
          >
            Host Officer Name
          </Label>
          <Select
            value={formData.hostOfficerName}
            onValueChange={(value) =>
              updateFormData({ hostOfficerName: value })
            }
          >
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Select the officers name" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="john-doe">John Doe</SelectItem>
              <SelectItem value="jane-smith">Jane Smith</SelectItem>
              <SelectItem value="mike-johnson">Mike Johnson</SelectItem>
              <SelectItem value="sarah-williams">Sarah Williams</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="hostOfficerDesignation"
            className="text-sm text-muted-foreground"
          >
            Host Officer Designation
          </Label>
          <Select
            value={formData.hostOfficerDesignation}
            onValueChange={(value) =>
              updateFormData({ hostOfficerDesignation: value })
            }
          >
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Select the designation" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="director">Director</SelectItem>
              <SelectItem value="executive">Executive</SelectItem>
              <SelectItem value="officer">Officer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="preferredVisitDate"
            className="text-sm text-muted-foreground"
          >
            Preferred Visit Date
          </Label>
          <Input
            id="preferredVisitDate"
            type="date"
            placeholder="DD/MM/YYYY"
            value={formData.preferredVisitDate}
            onChange={(e) =>
              updateFormData({ preferredVisitDate: e.target.value })
            }
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="preferredTimeSlot"
            className="text-sm text-muted-foreground"
          >
            Preferred Time Slot
          </Label>
          <Select
            value={formData.preferredTimeSlot}
            onValueChange={(value) =>
              updateFormData({ preferredTimeSlot: value })
            }
          >
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Select time slot" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="09:00-10:00">09:00 AM - 10:00 AM</SelectItem>
              <SelectItem value="10:00-11:00">10:00 AM - 11:00 AM</SelectItem>
              <SelectItem value="11:00-12:00">11:00 AM - 12:00 PM</SelectItem>
              <SelectItem value="12:00-13:00">12:00 PM - 01:00 PM</SelectItem>
              <SelectItem value="14:00-15:00">02:00 PM - 03:00 PM</SelectItem>
              <SelectItem value="15:00-16:00">03:00 PM - 04:00 PM</SelectItem>
              <SelectItem value="16:00-17:00">04:00 PM - 05:00 PM</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="expectedDuration"
            className="text-sm text-muted-foreground"
          >
            Expected Duration
          </Label>
          <Select
            value={formData.expectedDuration}
            onValueChange={(value) =>
              updateFormData({ expectedDuration: value })
            }
          >
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30min">30 Minutes</SelectItem>
              <SelectItem value="1hr">1 Hour</SelectItem>
              <SelectItem value="2hr">2 Hours</SelectItem>
              <SelectItem value="halfday">Half Day</SelectItem>
              <SelectItem value="fullday">Full Day</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm text-muted-foreground">
          Preferred View Visit
        </Label>
        <p className="text-xs text-muted-foreground">
          Security level for this visit
        </p>
        <RadioGroup
          value={formData.preferredViewVisit}
          onValueChange={(value) =>
            updateFormData({ preferredViewVisit: value })
          }
          className="flex gap-6"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="in-host" id="in-host" />
            <Label htmlFor="in-host" className="font-normal cursor-pointer">
              In Host
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="logins" id="logins" />
            <Label htmlFor="logins" className="font-normal cursor-pointer">
              Logins
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="high-security" id="high-security" />
            <Label
              htmlFor="high-security"
              className="font-normal cursor-pointer"
            >
              High Security
            </Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}
