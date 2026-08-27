import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { AlertTriangle, Save, X, FileText } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ROUTES } from "@/routes/config"
import { useToast } from "@/hooks/use-toast"

const incidentTypes = [
  "Smuggling",
  "Duty Evasion",
  "Prohibited Items",
  "Customs Fraud",
  "Border Security Breach",
  "Document Forgery",
  "Under-declaration",
  "Over-declaration",
  "Misclassification",
  "Contraband",
  "Intellectual Property Violation",
  "Sanctions Violation",
  "Customs Offense",
  "Warehouse Theft",
  "Container Tampering",
  "Human Trafficking",
  "Drug Trafficking",
  "Arms Trafficking",
  "Money Laundering",
  "Terrorism Financing"
]

const priorities = [
  { value: "Low", label: "Low", color: "bg-blue-100 text-blue-800" },
  { value: "Medium", label: "Medium", color: "bg-yellow-100 text-yellow-800" },
  { value: "High", label: "High", color: "bg-orange-100 text-orange-800" },
  { value: "Critical", label: "Critical", color: "bg-red-100 text-red-800" }
]

export default function IncidentCreationPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "",
    priority: "",
    location: "",
    reportedBy: "",
    witnesses: "",
    immediateActions: "",
    customsDeclarationNumber: "",
    containerNumber: "",
    billOfLadingNumber: "",
    importerName: "",
    exporterName: "",
    valueOfGoods: "",
    hsCode: "",
    customsStation: "",
    seizureDetails: "",
    fbrReferenceNumber: ""
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // TODO: Implement API call to create incident
      console.log("Creating incident:", formData)

      toast({
        title: "Incident Created",
        description: "The incident has been successfully reported and logged.",
      })

      navigate(ROUTES.INCIDENT_MANAGEMENT_DASHBOARD)
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to create incident. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const isFormValid = formData.title && formData.description && formData.type && formData.priority

  return (
    <ModulePageLayout
      title="Create New Incident"
      description="Report and document a new incident with all relevant details"
      actions={
        <Button variant="outline" onClick={() => navigate(ROUTES.INCIDENT_MANAGEMENT_DASHBOARD)}>
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="mr-2 h-5 w-5 text-red-500" />
              Incident Details
            </CardTitle>
            <CardDescription>
              Provide comprehensive information about the incident
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Incident Title *</Label>
                <Input
                  id="title"
                  placeholder="Brief description of the incident"
                  value={formData.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Incident Type *</Label>
                <Select value={formData.type} onValueChange={(value) => handleInputChange("type", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select incident type" />
                  </SelectTrigger>
                  <SelectContent>
                    {incidentTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Detailed description of what occurred"
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                rows={4}
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority Level *</Label>
                <Select value={formData.priority} onValueChange={(value) => handleInputChange("priority", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {priorities.map((priority) => (
                      <SelectItem key={priority.value} value={priority.value}>
                        <div className="flex items-center">
                          <Badge className={`mr-2 ${priority.color}`}>
                            {priority.label}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="Where did the incident occur?"
                  value={formData.location}
                  onChange={(e) => handleInputChange("location", e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="reportedBy">Reported By</Label>
                <Input
                  id="reportedBy"
                  placeholder="Name of person reporting"
                  value={formData.reportedBy}
                  onChange={(e) => handleInputChange("reportedBy", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="witnesses">Witnesses</Label>
                <Input
                  id="witnesses"
                  placeholder="Names of witnesses (comma separated)"
                  value={formData.witnesses}
                  onChange={(e) => handleInputChange("witnesses", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="immediateActions">Immediate Actions Taken</Label>
              <Textarea
                id="immediateActions"
                placeholder="What actions were taken immediately after the incident?"
                value={formData.immediateActions}
                onChange={(e) => handleInputChange("immediateActions", e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="mr-2 h-5 w-5 text-blue-500" />
              Customs-Specific Information
            </CardTitle>
            <CardDescription>
              Provide details related to customs declarations, shipments, and goods
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customsDeclarationNumber">Customs Declaration Number</Label>
                <Input
                  id="customsDeclarationNumber"
                  placeholder="GD Declaration Number"
                  value={formData.customsDeclarationNumber}
                  onChange={(e) => handleInputChange("customsDeclarationNumber", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="containerNumber">Container Number</Label>
                <Input
                  id="containerNumber"
                  placeholder="Container/BL Number"
                  value={formData.containerNumber}
                  onChange={(e) => handleInputChange("containerNumber", e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="billOfLadingNumber">Bill of Lading Number</Label>
                <Input
                  id="billOfLadingNumber"
                  placeholder="BL/AWB Number"
                  value={formData.billOfLadingNumber}
                  onChange={(e) => handleInputChange("billOfLadingNumber", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hsCode">HS Code</Label>
                <Input
                  id="hsCode"
                  placeholder="Harmonized System Code"
                  value={formData.hsCode}
                  onChange={(e) => handleInputChange("hsCode", e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="importerName">Importer Name</Label>
                <Input
                  id="importerName"
                  placeholder="Name of importer"
                  value={formData.importerName}
                  onChange={(e) => handleInputChange("importerName", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="exporterName">Exporter Name</Label>
                <Input
                  id="exporterName"
                  placeholder="Name of exporter"
                  value={formData.exporterName}
                  onChange={(e) => handleInputChange("exporterName", e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="valueOfGoods">Value of Goods (PKR)</Label>
                <Input
                  id="valueOfGoods"
                  type="number"
                  placeholder="Declared value in PKR"
                  value={formData.valueOfGoods}
                  onChange={(e) => handleInputChange("valueOfGoods", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customsStation">Customs Station</Label>
                <Select value={formData.customsStation} onValueChange={(value) => handleInputChange("customsStation", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customs station" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="karachi">Karachi Port</SelectItem>
                    <SelectItem value="lahore">Lahore Dry Port</SelectItem>
                    <SelectItem value="islamabad">Islamabad Airport</SelectItem>
                    <SelectItem value="peshawar">Peshawar Dry Port</SelectItem>
                    <SelectItem value="quetta">Quetta Dry Port</SelectItem>
                    <SelectItem value="multan">Multan Dry Port</SelectItem>
                    <SelectItem value="faisalabad">Faisalabad Dry Port</SelectItem>
                    <SelectItem value="sialkot">Sialkot Airport</SelectItem>
                    <SelectItem value="gwadar">Gwadar Port</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="seizureDetails">Seizure Details (if applicable)</Label>
              <Textarea
                id="seizureDetails"
                placeholder="Details of any goods seized, quantities, estimated value, etc."
                value={formData.seizureDetails}
                onChange={(e) => handleInputChange("seizureDetails", e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fbrReferenceNumber">FBR Reference Number</Label>
              <Input
                id="fbrReferenceNumber"
                placeholder="Federal Board of Revenue reference"
                value={formData.fbrReferenceNumber}
                onChange={(e) => handleInputChange("fbrReferenceNumber", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Evidence & Documentation</CardTitle>
            <CardDescription>
              Upload initial evidence or note where evidence can be collected
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <AlertTriangle className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">
                  Evidence collection will be handled in the Evidence Collection module
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  After creating the incident, you can add evidence through the dedicated evidence collection page
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(ROUTES.INCIDENT_MANAGEMENT_DASHBOARD)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={!isFormValid || loading}>
            <Save className="mr-2 h-4 w-4" />
            {loading ? "Creating..." : "Create Incident"}
          </Button>
        </div>
      </form>
    </ModulePageLayout>
  )
}