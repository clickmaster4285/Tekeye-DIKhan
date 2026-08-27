"use client"

import { useState, useEffect } from "react"
import { Brain, Package, Plus, X } from "lucide-react"
import { ModulePageLayout } from "@/components/dashboard/module-page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export default function AiItemCatalogingPage() {
  const [items, setItems] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({ id: "", description: "", category: "", status: "Pending" })
  const [search, setSearch] = useState("")

  // Load items from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("aiCatalogItems")
    if (stored) setItems(JSON.parse(stored))
  }, [])

  // Save to localStorage whenever items change
  useEffect(() => {
    localStorage.setItem("aiCatalogItems", JSON.stringify(items))
  }, [items])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const id = formData.id || `ITM-${Math.floor(Math.random() * 9000 + 1000)}`
    setItems([{ ...formData, id }, ...items])
    setFormData({ id: "", description: "", category: "", status: "Pending" })
    setShowModal(false)
  }

  // Filtered items based on search
  const filteredItems = items.filter(
    (item) =>
      item.id.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <ModulePageLayout
      title="AI Item Cataloging"
      description="AI-assisted cataloging and classification of seized items."
      breadcrumbs={[{ label: "WMS" }, { label: "AI Item Cataloging" }]}
    >
      <div className="grid gap-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cataloged Today</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{items.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Items</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">AI Accuracy</CardTitle>
              <Brain className="h-4 w-4 text-[#3b82f6]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">98%</div>
              <p className="text-xs text-muted-foreground mt-1">Classification</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Review</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{items.filter(i => i.status === "Pending").length}</div>
              <p className="text-xs text-muted-foreground mt-1">Awaiting approval</p>
            </CardContent>
          </Card>
        </div>

        {/* Item Catalog Table */}
        <Card className="w-full min-w-0">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <CardTitle>Item Catalog</CardTitle>
              <CardDescription className="break-words">AI-classified items and categories</CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Input
                placeholder="Search items..."
                className="w-full sm:w-64"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Button
                className="w-full bg-[#3b82f6] text-white hover:bg-[#2563eb] sm:w-auto"
                onClick={() => setShowModal(true)}
              >
                <Plus className="h-4 w-4 mr-2" /> Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent className="w-full min-w-0 space-y-3">
            <div className="divide-y rounded-lg border md:hidden">
              {filteredItems.map((row) => (
                <div key={row.id} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{row.id}</p>
                    <Badge variant={row.status === "Approved" ? "default" : "secondary"}>{row.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm">{row.description}</p>
                  <p className="text-xs text-muted-foreground">Category: {row.category || "—"}</p>
                  <Button variant="ghost" size="sm" className="mt-1 h-7 px-0 text-[#3b82f6]">Edit</Button>
                </div>
              ))}
            </div>

            <div className="hidden w-full min-w-0 md:block">
              <div className="w-full max-w-full overflow-x-auto rounded-lg border pb-2">
                <Table className="min-w-[820px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item ID</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Category (AI)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.id}</TableCell>
                        <TableCell>{row.description}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{row.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={row.status === "Approved" ? "default" : "secondary"}>{row.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="text-[#3b82f6]">Edit</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal for adding new item */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
          <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-lg">
            <button
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
              onClick={() => setShowModal(false)}
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold mb-4">Add New Catalog Item</h2>
            <form onSubmit={handleFormSubmit} className="space-y-3">
              <Input
                placeholder="Item ID (auto-generated if empty)"
                name="id"
                value={formData.id}
                onChange={handleInputChange}
              />
              <Input
                placeholder="Description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                required
              />
              <Input
                placeholder="Category"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                required
              />
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded-md px-2 py-1"
              >
                <option>Pending</option>
                <option>Approved</option>
              </select>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white w-full">
                Save Item
              </Button>
            </form>
          </div>
        </div>
      )}
    </ModulePageLayout>
  )
}