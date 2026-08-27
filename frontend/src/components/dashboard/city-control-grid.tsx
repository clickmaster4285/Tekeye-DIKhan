import { useState } from "react"
import { Eye, MoreVertical } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { CityDetailsModal, type CityDetails } from "@/components/dashboard/city-details-modal"

type CityRow = CityDetails

const CITIES_DATA: CityRow[] = [
  {
    city: "Peshawar (Head Office)",
    status: "Online",
    visitors: 214,
    vehicles: 1342,
    cases: 78,
    alerts: 3,
    cameraCount: 24,
    activeCameras: 22,
    offlineCameras: 2,
    coverageZones: 6,
    storageUsed: "78%",
    uptime: "99.9%",
    lastUpdate: "2 min ago",
    cameraTypes: [
      { name: "ANPR", count: 10, description: "License plate recognition" },
      { name: "Face", count: 6, description: "Facial identification" },
      { name: "Perimeter", count: 8, description: "Perimeter protection" },
    ],
  },
  {
    city: "Kohat",
    status: "Online",
    visitors: 182,
    vehicles: 1110,
    cases: 64,
    alerts: 1,
    cameraCount: 18,
    activeCameras: 17,
    offlineCameras: 1,
    coverageZones: 5,
    storageUsed: "63%",
    uptime: "99.4%",
    lastUpdate: "5 min ago",
    cameraTypes: [
      { name: "ANPR", count: 8, description: "License plate recognition" },
      { name: "Dome", count: 6, description: "Wide area coverage" },
      { name: "PTZ", count: 4, description: "Pan-tilt-zoom tracking" },
    ],
  },
  {
    city: "Nowshera",
    status: "Online",
    visitors: 305,
    vehicles: 1980,
    cases: 143,
    alerts: 9,
    cameraCount: 28,
    activeCameras: 25,
    offlineCameras: 3,
    coverageZones: 7,
    storageUsed: "82%",
    uptime: "98.9%",
    lastUpdate: "8 min ago",
    cameraTypes: [
      { name: "ANPR", count: 12, description: "License plate recognition" },
      { name: "Face", count: 8, description: "Facial identification" },
      { name: "Thermal", count: 8, description: "Heat detection" },
    ],
  },
  {
    city: "Mardan",
    status: "Attention",
    visitors: 156,
    vehicles: 892,
    cases: 45,
    alerts: 2,
    cameraCount: 16,
    activeCameras: 15,
    offlineCameras: 1,
    coverageZones: 4,
    storageUsed: "54%",
    uptime: "99.1%",
    lastUpdate: "12 min ago",
    cameraTypes: [
      { name: "ANPR", count: 6, description: "License plate recognition" },
      { name: "Dome", count: 6, description: "Wide area coverage" },
      { name: "Infrared", count: 4, description: "Low-light monitoring" },
    ],
  },
  {
    city: "DI Khan",
    status: "Attention",
    visitors: 89,
    vehicles: 567,
    cases: 34,
    alerts: 0,
    cameraCount: 14,
    activeCameras: 14,
    offlineCameras: 0,
    coverageZones: 4,
    storageUsed: "49%",
    uptime: "99.7%",
    lastUpdate: "15 min ago",
    cameraTypes: [
      { name: "ANPR", count: 5, description: "License plate recognition" },
      { name: "Dome", count: 5, description: "Wide area coverage" },
      { name: "Perimeter", count: 4, description: "Perimeter protection" },
    ],
  },
  {
    city: "SWH Ratta Kulachi",
    status: "Online",
    visitors: 42,
    vehicles: 210,
    cases: 12,
    alerts: 0,
    cameraCount: 8,
    activeCameras: 8,
    offlineCameras: 0,
    coverageZones: 3,
    storageUsed: "38%",
    uptime: "99.8%",
    lastUpdate: "6 min ago",
    cameraTypes: [
      { name: "ANPR", count: 3, description: "License plate recognition" },
      { name: "Dome", count: 3, description: "Wide area coverage" },
      { name: "Perimeter", count: 2, description: "Perimeter protection" },
    ],
  },
]

const getStatusColor = (status: string) => {
  switch (status) {
    case "Online":
      return "text-green-400"
    case "Critical":
      return "text-red-400"
    case "Attention":
      return "text-yellow-400"
    default:
      return "text-gray-400"
  }
}

const getStatusBgColor = (status: string) => {
  switch (status) {
    case "Online":
      return "bg-green-400"
    case "Critical":
      return "bg-red-400"
    case "Attention":
      return "bg-yellow-400"
    default:
      return "bg-gray-400"
  }
}

const getAlertBgColor = (alerts: number) => {
  if (alerts >= 5) return "bg-red-500"
  if (alerts >= 3) return "bg-orange-500"
  return "bg-yellow-500"
}

export function CityControlGrid() {
  const [selectedCity, setSelectedCity] = useState<CityRow | null>(null)

  return (
    <>
      <Card className="min-w-0 overflow-hidden rounded-[10px] border-gray-200 bg-white">
        <CardContent className="p-0">
        <div className="px-4 py-5 sm:px-6 sm:py-6">
          <h2 className="text-xl font-bold text-black sm:text-2xl">City Control Grid</h2>
          <p className="mt-1 text-sm text-gray-600">Real-time status of all connected cities</p>
        </div>
        <div className="border-t border-gray-200">
          <div className="overflow-x-auto min-h-[360px]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left font-semibold text-black sm:px-6">CITY</th>
                  <th className="px-4 py-3 text-left font-semibold text-black sm:px-6">STATUS</th>
                  <th className="px-4 py-3 text-right font-semibold text-black sm:px-6">VISITORS</th>
                  <th className="px-4 py-3 text-right font-semibold text-black sm:px-6">VEHICLES</th>
                  <th className="px-4 py-3 text-right font-semibold text-black sm:px-6">GOODS CASES</th>
                  <th className="px-4 py-3 text-center font-semibold text-black sm:px-6">ALERTS</th>
                  <th className="px-4 py-3 text-center font-semibold text-black sm:px-6">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {CITIES_DATA.map((row) => (
                  <tr
                    key={row.city}
                    className="cursor-pointer hover:bg-gray-50 transition-colors border-0"
                    onClick={() => setSelectedCity(row)}
                  >
                    <td className="px-4 py-3 font-medium text-black sm:px-6">{row.city}</td>
                    <td className="px-4 py-3 sm:px-6">
                      <span className={`inline-flex items-center gap-2 ${getStatusColor(row.status)}`}>
                        <span className={`h-2 w-2 rounded-full ${getStatusBgColor(row.status)}`}></span>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-black sm:px-6">
                      {row.visitors.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-black sm:px-6">
                      {row.vehicles.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-black sm:px-6">
                      {row.cases.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center sm:px-6">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white ${getAlertBgColor(row.alerts)}`}
                      >
                        {row.alerts}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center sm:px-6">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          className="text-blue-500 hover:text-blue-600 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedCity(row)
                          }}
                          type="button"
                        >
                          <Eye className="h-5 w-5" />
                        </button>
                        <button
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                          type="button"
                        >
                          <MoreVertical className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>

      <CityDetailsModal
        open={Boolean(selectedCity)}
        onOpenChange={(open) => {
          if (!open) setSelectedCity(null)
        }}
        details={selectedCity}
      />
    </>
  )
}
