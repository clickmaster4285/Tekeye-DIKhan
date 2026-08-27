// components/visitor/scanned-qr-data-table.tsx
import React from 'react';
import { cn } from "@/lib/utils"

interface ScannedQRDataTableProps {
  qrPayload: string | null;
  className?: string;
}

export function ScannedQRDataTable({ qrPayload, className }: ScannedQRDataTableProps) {
  // Function to parse and format the QR payload
  const parseQRPayload = (payload: string | null) => {
    if (!payload) return null;
    
    try {
      // Try to parse as JSON
      const parsedData = JSON.parse(payload);
      
      // Convert to array of key-value pairs
      return Object.entries(parsedData).map(([key, value]) => ({
        key: formatKey(key),
        value: formatValue(value)
      }));
    } catch (error) {
      // If not valid JSON, return as raw text
      return [{ key: 'Raw Data', value: payload }];
    }
  };

  // Helper function to format keys (convert camelCase to Title Case)
  const formatKey = (key: string) => {
    return key
      .replace(/([A-Z])/g, ' $1') // Insert space before capital letters
      .replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
      .trim();
  };

  // Helper function to format values
  const formatValue = (value: any) => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const tableData = parseQRPayload(qrPayload);

  if (!qrPayload) {
    return (
      <div className={cn("text-sm text-muted-foreground p-4 text-center border border-dashed rounded-lg", className)}>
        No QR data to display. Paste a QR payload above.
      </div>
    );
  }

  if (!tableData || tableData.length === 0) {
    return (
      <div className={cn("text-sm text-red-500 p-4 text-center border border-dashed rounded-lg", className)}>
        Invalid QR payload format. Please check the JSON.
      </div>
    );
  }

  return (
    <div className={cn("border rounded-lg overflow-hidden", className)}>
      <table className="w-full text-sm">
        <tbody className="divide-y">
          {tableData.map((item, index) => (
            <tr key={index} className={index % 2 === 0 ? 'bg-muted/50' : ''}>
              <td className="px-4 py-2 font-semibold text-foreground border-r w-1/3">
                {item.key}
              </td>
              <td className="px-4 py-2 text-foreground">
                {item.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}