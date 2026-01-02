/**
 * AccessibleReservationCard - Example Component
 *
 * This is a reference implementation showing accessibility best practices.
 * Use this as a guide when building new components.
 *
 * WCAG 2.1 AA Compliance Features:
 * - Semantic HTML structure
 * - Proper heading hierarchy
 * - Keyboard navigation support
 * - Screen reader announcements
 * - Color contrast compliance
 * - Focus management
 * - ARIA attributes
 */

"use client"

import * as React from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { IconButton } from "@/components/ui/icon-button"
import { VisuallyHidden } from "@/components/ui/visually-hidden"
import { useAccessibility } from "@/components/accessibility/AccessibilityProvider"
import { Calendar, MapPin, Users, Trash2, Edit } from "lucide-react"
import { cn } from "@/lib/utils"

interface ReservationCardProps {
  id: string
  guestName: string
  siteNumber: string
  checkIn: Date
  checkOut: Date
  status: "confirmed" | "pending" | "checked-in" | "cancelled"
  adults: number
  children: number
  balanceDue: number
  onEdit?: () => void
  onDelete?: () => void
}

export function AccessibleReservationCard({
  id,
  guestName,
  siteNumber,
  checkIn,
  checkOut,
  status,
  adults,
  children,
  balanceDue,
  onEdit,
  onDelete,
}: ReservationCardProps) {
  const { announceMessage } = useAccessibility()
  const [isDeleting, setIsDeleting] = React.useState(false)

  // Format dates for display
  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-US", { month: "short", day: "numeric" })

  // Status badge configuration
  const statusConfig = {
    confirmed: {
      variant: "success" as const,
      text: "Confirmed",
      srText: "Reservation status: confirmed",
    },
    pending: {
      variant: "warning" as const,
      text: "Pending",
      srText: "Reservation status: pending confirmation",
    },
    "checked-in": {
      variant: "info" as const,
      text: "Checked In",
      srText: "Reservation status: guest has checked in",
    },
    cancelled: {
      variant: "destructive" as const,
      text: "Cancelled",
      srText: "Reservation status: cancelled",
    },
  }

  const currentStatus = statusConfig[status]

  const handleDelete = async () => {
    if (!onDelete) return

    setIsDeleting(true)
    announceMessage("Deleting reservation", "polite")

    try {
      await onDelete()
      announceMessage(`Reservation for ${guestName} deleted`, "assertive")
    } catch (error) {
      announceMessage("Failed to delete reservation", "assertive")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <article
      className={cn(
        "rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow",
        "hover:shadow-md focus-within:shadow-md"
      )}
      aria-labelledby={`reservation-${id}-title`}
    >
      {/* Header */}
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Guest name as h2 for proper hierarchy */}
          <h2
            id={`reservation-${id}-title`}
            className="text-lg font-semibold text-foreground truncate"
          >
            <Link
              href={`/reservations/${id}`}
              className="hover:text-action-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action-primary focus-visible:ring-offset-2 rounded"
            >
              {guestName}
              <VisuallyHidden>, Reservation details</VisuallyHidden>
            </Link>
          </h2>

          {/* Site number */}
          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Site {siteNumber}</span>
          </p>
        </div>

        {/* Status badge */}
        <Badge
          variant={currentStatus.variant}
          srText={currentStatus.srText}
          className="shrink-0"
        >
          {currentStatus.text}
        </Badge>
      </header>

      {/* Reservation details */}
      <dl className="space-y-2 mb-4">
        {/* Dates */}
        <div className="flex items-center gap-2 text-sm">
          <dt className="sr-only">Check-in and check-out dates</dt>
          <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <dd className="text-foreground">
            <time dateTime={checkIn.toISOString()}>
              {formatDate(checkIn)}
            </time>
            {" – "}
            <time dateTime={checkOut.toISOString()}>
              {formatDate(checkOut)}
            </time>
          </dd>
        </div>

        {/* Guests */}
        <div className="flex items-center gap-2 text-sm">
          <dt className="sr-only">Number of guests</dt>
          <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <dd className="text-foreground">
            {adults} {adults === 1 ? "adult" : "adults"}
            {children > 0 && `, ${children} ${children === 1 ? "child" : "children"}`}
          </dd>
        </div>
      </dl>

      {/* Balance due alert */}
      {balanceDue > 0 && (
        <div
          className="mb-4 rounded-md border border-status-warning-border bg-status-warning-bg p-3"
          role="alert"
          aria-live="polite"
        >
          <p className="text-sm font-semibold text-status-warning-foreground">
            Balance Due: ${(balanceDue / 100).toFixed(2)}
          </p>
        </div>
      )}

      {/* Actions */}
      <footer className="flex items-center gap-2 pt-3 border-t border-border">
        <Link
          href={`/reservations/${id}`}
          className={cn(
            "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium",
            "border border-border bg-card text-foreground",
            "hover:bg-muted",
            "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20 focus-visible:ring-offset-2",
            "transition-colors"
          )}
        >
          View Details
        </Link>

        <div className="flex-1" />

        {/* Action buttons */}
        {onEdit && (
          <IconButton
            ariaLabel={`Edit reservation for ${guestName}`}
            icon={<Edit className="h-4 w-4" />}
            variant="ghost"
            size="icon"
            onClick={onEdit}
          />
        )}

        {onDelete && (
          <IconButton
            ariaLabel={`Delete reservation for ${guestName}`}
            icon={<Trash2 className="h-4 w-4" />}
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            disabled={isDeleting}
          />
        )}
      </footer>
    </article>
  )
}

/**
 * Key Accessibility Features Demonstrated:
 *
 * 1. Semantic HTML:
 *    - <article> for card container
 *    - <header> and <footer> for structure
 *    - <dl>, <dt>, <dd> for key-value pairs
 *    - <time> with datetime attribute
 *
 * 2. Heading Hierarchy:
 *    - h2 for guest name (assuming h1 is page title)
 *
 * 3. ARIA Attributes:
 *    - aria-labelledby connects article to heading
 *    - aria-hidden on decorative icons
 *    - role="alert" for important messages
 *    - aria-live for dynamic content
 *
 * 4. Screen Reader Support:
 *    - VisuallyHidden for additional context
 *    - Descriptive aria-labels on icon buttons
 *    - Screen reader announcements on actions
 *
 * 5. Keyboard Navigation:
 *    - All interactive elements focusable
 *    - Visible focus indicators (ring-4)
 *    - Logical tab order
 *
 * 6. Color Contrast:
 *    - Sufficient contrast on all text
 *    - Status conveyed by text + color
 *    - Focus rings meet 3:1 ratio
 *
 * 7. Focus Management:
 *    - Focus-within on card for context
 *    - Enhanced focus rings on all interactive elements
 *    - Disabled state handled correctly
 */
