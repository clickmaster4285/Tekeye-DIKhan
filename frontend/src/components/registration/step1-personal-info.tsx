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
import { User, Building2, Wrench } from "lucide-react";

interface Step1Props {
  formData: {
    visitorType: string;
    fullName: string;
    gender: string;
    cnicNumber: string;
    passportNumber: string;
    nationality: string;
    dateOfBirth: string;
    mobileNumber: string;
    emailAddress: string;
    residentialAddress: string;
  };
  updateFormData: (data: Partial<Step1Props["formData"]>) => void;
}

export function Step1PersonalInfo({ formData, updateFormData }: Step1Props) {
  return (
    <div className="space-y-8">
      {/* Visitor Type */}
      <div>
        <h3 className="text-base font-medium text-foreground mb-1">
          Visitor Type <span className="text-red-500">*</span>
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Please select one type
        </p>
        <RadioGroup
          value={formData.visitorType}
          onValueChange={(value) => updateFormData({ visitorType: value })}
          className="flex gap-4"
        >
          <label
            htmlFor="individual"
            className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all flex-1 ${
              formData.visitorType === "individual"
                ? "border-[#3b82f6] bg-[#3b82f6]/5"
                : "border-border hover:border-[#3b82f6]/50"
            }`}
          >
            <RadioGroupItem value="individual" id="individual" />
            <div className="w-10 h-10 rounded-full bg-[#3b82f6]/10 flex items-center justify-center">
              <User className="w-5 h-5 text-[#3b82f6]" />
            </div>
            <div>
              <p className="font-medium text-foreground">Individual</p>
              <p className="text-xs text-muted-foreground">
                Personal visit or guest
              </p>
            </div>
          </label>
          <label
            htmlFor="company"
            className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all flex-1 ${
              formData.visitorType === "company"
                ? "border-[#3b82f6] bg-[#3b82f6]/5"
                : "border-border hover:border-[#3b82f6]/50"
            }`}
          >
            <RadioGroupItem value="company" id="company" />
            <div className="w-10 h-10 rounded-full bg-[#3b82f6]/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-[#3b82f6]" />
            </div>
            <div>
              <p className="font-medium text-foreground">Company Rep.</p>
              <p className="text-xs text-muted-foreground">
                Business meetings or official
              </p>
            </div>
          </label>
          <label
            htmlFor="contractor"
            className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all flex-1 ${
              formData.visitorType === "contractor"
                ? "border-[#3b82f6] bg-[#3b82f6]/5"
                : "border-border hover:border-[#3b82f6]/50"
            }`}
          >
            <RadioGroupItem value="contractor" id="contractor" />
            <div className="w-10 h-10 rounded-full bg-[#3b82f6]/10 flex items-center justify-center">
              <Wrench className="w-5 h-5 text-[#3b82f6]" />
            </div>
            <div>
              <p className="font-medium text-foreground">Contractor</p>
              <p className="text-xs text-muted-foreground">
                Maintenance or service
              </p>
            </div>
          </label>
        </RadioGroup>
      </div>

      {/* Personal Details */}
      <div>
        <h3 className="text-base font-medium text-foreground mb-4">
          Personal Details
        </h3>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-sm text-muted-foreground">
              Full Name <span className="text-red-500">*</span>{" "}
              <span className="text-muted-foreground">(As per CNIC/Passport)</span>
            </Label>
            <Input
              id="fullName"
              placeholder="e.g. Muhammad Ali Hassan"
              value={formData.fullName}
              onChange={(e) => updateFormData({ fullName: e.target.value })}
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">Use CNIC/Passport &</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gender" className="text-sm text-muted-foreground">
              Gender
            </Label>
            <Select
              value={formData.gender}
              onValueChange={(value) => updateFormData({ gender: value })}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Male/Female/Other" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="cnicNumber"
              className="text-sm text-muted-foreground"
            >
              CNIC Number
            </Label>
            <Input
              id="cnicNumber"
              placeholder="XXXXX-XXXXXXX-X"
              value={formData.cnicNumber}
              onChange={(e) => updateFormData({ cnicNumber: e.target.value })}
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">
              Mandatory for Pakistani Nationals
            </p>
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="passportNumber"
              className="text-sm text-muted-foreground"
            >
              Passport Number
            </Label>
            <Input
              id="passportNumber"
              placeholder="XXXXXXXX"
              value={formData.passportNumber}
              onChange={(e) =>
                updateFormData({ passportNumber: e.target.value })
              }
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">
              Mandatory for Non-Pak Nationals
            </p>
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="nationality"
              className="text-sm text-muted-foreground"
            >
              Nationality <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.nationality}
              onValueChange={(value) => updateFormData({ nationality: value })}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Country of Citizenship" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pakistan">Pakistan</SelectItem>
                <SelectItem value="usa">United States</SelectItem>
                <SelectItem value="uk">United Kingdom</SelectItem>
                <SelectItem value="uae">UAE</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="dateOfBirth"
              className="text-sm text-muted-foreground"
            >
              Date of Birth
            </Label>
            <Input
              id="dateOfBirth"
              type="date"
              placeholder="For Identity Verification"
              value={formData.dateOfBirth}
              onChange={(e) => updateFormData({ dateOfBirth: e.target.value })}
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="mobileNumber"
              className="text-sm text-muted-foreground"
            >
              Mobile Number <span className="text-red-500">*</span>
            </Label>
            <Input
              id="mobileNumber"
              placeholder="+XX-XXXXXXXXXX"
              value={formData.mobileNumber}
              onChange={(e) => updateFormData({ mobileNumber: e.target.value })}
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">
              SMS Notification & OTP
            </p>
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="emailAddress"
              className="text-sm text-muted-foreground"
            >
              Email Address
            </Label>
            <Input
              id="emailAddress"
              type="email"
              placeholder="emailhere@email.com"
              value={formData.emailAddress}
              onChange={(e) => updateFormData({ emailAddress: e.target.value })}
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">
              E-confirmation and Status Updated
            </p>
          </div>
          <div className="col-span-2 space-y-2">
            <Label
              htmlFor="residentialAddress"
              className="text-sm text-muted-foreground"
            >
              Residential Address
            </Label>
            <Textarea
              id="residentialAddress"
              placeholder="e.g. House #, Street Name, City"
              value={formData.residentialAddress}
              onChange={(e) =>
                updateFormData({ residentialAddress: e.target.value })
              }
              className="min-h-[80px] resize-none"
            />
            <p className="text-xs text-muted-foreground">Citizen Address</p>
          </div>
        </div>
      </div>
    </div>
  );
}
