"use client";

import { useState, useMemo, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, LucideIcon } from "lucide-react";
import { StatusFilter, StatusValue } from "./StatusFilter";
import { TablePagination } from "./TablePagination";
import { cn } from "@/lib/utils";

interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (item: T) => ReactNode;
  className?: string;
  sortable?: boolean;
}

interface EmptyState {
  icon: LucideIcon;
  title: string;
  description: string;
}

interface SettingsTableProps<T extends { id: string }> {
  data: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  searchFields?: (keyof T)[];
  addLabel?: string;
  onAdd?: () => void;
  onRowClick?: (item: T) => void;
  getRowActions?: (item: T) => ReactNode;
  getItemStatus?: (item: T) => "active" | "inactive";
  emptyState?: EmptyState;
  pageSize?: number;
  isLoading?: boolean;
  className?: string;
}

export function SettingsTable<T extends { id: string }>({
  data,
  columns,
  searchPlaceholder = "Search...",
  searchFields,
  addLabel = "Add",
  onAdd,
  onRowClick,
  getRowActions,
  getItemStatus,
  emptyState,
  pageSize = 10,
  isLoading,
  className,
}: SettingsTableProps<T>) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusValue>("active");
  const [page, setPage] = useState(1);

  // Filter data
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      // Status filter
      if (status !== "all" && getItemStatus) {
        const itemStatus = getItemStatus(item);
        if (status === "active" && itemStatus !== "active") return false;
        if (status === "inactive" && itemStatus !== "inactive") return false;
      }

      // Search filter
      if (search && searchFields) {
        const searchLower = search.toLowerCase();
        return searchFields.some((field) => {
          const value = item[field];
          return String(value).toLowerCase().includes(searchLower);
        });
      }

      return true;
    });
  }, [data, status, search, searchFields, getItemStatus]);

  // Paginate
  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = useMemo(() => {
    return filteredData.slice((page - 1) * pageSize, page * pageSize);
  }, [filteredData, page, pageSize]);

  // Reset page when filters change
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleStatusChange = (value: StatusValue) => {
    setStatus(value);
    setPage(1);
  };

  // Render loading skeleton
  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex justify-between">
          <div className="h-10 w-64 bg-muted rounded-md animate-pulse" />
          <div className="h-10 w-48 bg-muted rounded-md animate-pulse" />
        </div>
        <div className="border rounded-lg">
          <div className="h-12 bg-muted border-b" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 border-b last:border-0 flex items-center px-4">
              <div className="h-4 bg-muted rounded w-full animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const EmptyIcon = emptyState?.icon;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 w-64"
              aria-label={searchPlaceholder}
            />
          </div>
          {onAdd && (
            <Button onClick={onAdd}>
              <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
              {addLabel}
            </Button>
          )}
        </div>

        {getItemStatus && (
          <StatusFilter value={status} onChange={handleStatusChange} />
        )}
      </div>

      {/* Table or Empty State */}
      {paginatedData.length > 0 ? (
        <div className="border rounded-lg overflow-hidden bg-card">
          <table className="w-full">
            <thead>
              <tr className="bg-muted border-b">
                {columns.map((column) => (
                  <th
                    key={String(column.key)}
                    scope="col"
                    className={cn(
                      "px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider",
                      column.className
                    )}
                  >
                    {column.label}
                  </th>
                ))}
                {getRowActions && (
                  <th
                    scope="col"
                    className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider"
                  >
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedData.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => onRowClick?.(item)}
                  className={cn(
                    "hover:bg-muted transition-colors",
                    onRowClick && "cursor-pointer"
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={String(column.key)}
                      className={cn("px-4 py-3 text-sm text-foreground", column.className)}
                    >
                      {column.render
                        ? column.render(item)
                        : String(item[column.key as keyof T] ?? "")}
                    </td>
                  ))}
                  {getRowActions && (
                    <td className="px-4 py-3 text-right">
                      {getRowActions(item)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        // Empty state
        emptyState && EmptyIcon && (
          <div className="text-center py-12 border-2 border-dashed rounded-lg bg-card">
            <EmptyIcon className="h-10 w-10 mx-auto text-muted-foreground" aria-hidden="true" />
            <h3 className="mt-3 font-medium text-foreground">{emptyState.title}</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              {emptyState.description}
            </p>
            {onAdd && (
              <Button className="mt-4" onClick={onAdd}>
                <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                {addLabel}
              </Button>
            )}
          </div>
        )
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <TablePagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={filteredData.length}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
