"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Column {
  key: string;
  label: string;
  format?: (value: any) => React.ReactNode;
  align?: "left" | "center" | "right";
}

interface DataTableProps {
  title: string;
  description?: string;
  columns: Column[];
  data: any[];
  loading?: boolean;
  maxRows?: number;
}

export function DataTable({
  title,
  description,
  columns,
  data,
  loading = false,
  maxRows,
}: DataTableProps) {
  const displayData = maxRows ? data.slice(0, maxRows) : data;

  if (loading) {
    return (
      <Card className="bg-muted/50 border-border">
        <CardHeader>
          <CardTitle className="text-lg text-white">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-8 w-full bg-muted/50 rounded" />
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 w-full bg-muted/30 rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-muted/50 border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-white">{title}</CardTitle>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    className={`text-muted-foreground ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}`}
                  >
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayData.length === 0 ? (
                <TableRow className="border-border">
                  <TableCell colSpan={columns.length} className="text-center text-muted-foreground py-8">
                    No data available
                  </TableCell>
                </TableRow>
              ) : (
                displayData.map((row, idx) => (
                  <TableRow key={idx} className="border-border hover:bg-muted/30">
                    {columns.map((col) => (
                      <TableCell
                        key={col.key}
                        className={`text-muted-foreground ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}`}
                      >
                        {col.format ? col.format(row[col.key]) : row[col.key]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {maxRows && data.length > maxRows && (
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Showing {maxRows} of {data.length} rows
          </p>
        )}
      </CardContent>
    </Card>
  );
}
