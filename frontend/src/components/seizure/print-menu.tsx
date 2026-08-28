import { Link } from "react-router-dom"
import { ChevronDown, FileOutput, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function PrintMenu({ printHref, pdfHref }: { printHref: string; pdfHref: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Printer className="h-4 w-4 mr-2" />
          Print
          <ChevronDown className="h-4 w-4 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-0 w-max">
        <DropdownMenuItem asChild>
          <Link to={printHref}>
            <Printer className="h-4 w-4" />
            Print
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={pdfHref}>
            <FileOutput className="h-4 w-4" />
            Save as PDF
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
