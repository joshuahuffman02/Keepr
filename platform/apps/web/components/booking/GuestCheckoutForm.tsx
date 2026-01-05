"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { User, Mail, Phone, MapPin, Shield, Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ValidatedFormField, EmailFormField, PhoneFormField } from "./ValidatedFormField";
import { useFormValidation, validators } from "@/hooks/use-form-validation";
import { cn } from "@/lib/utils";

interface GuestCheckoutFormProps {
  onSubmit: (data: GuestInfo) => void;
  onSignIn?: () => void;
  isLoading?: boolean;
  className?: string;
}

export interface GuestInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  zipCode: string;
}

export function GuestCheckoutForm({
  onSubmit,
  onSignIn,
  isLoading = false,
  className
}: GuestCheckoutFormProps) {
  const prefersReducedMotion = useReducedMotion();
  const [showSignIn, setShowSignIn] = useState(false);

  const form = useFormValidation(
    {
      firstName: { rules: [validators.required("First name is required"), validators.maxLength(50)] },
      lastName: { rules: [validators.required("Last name is required"), validators.maxLength(50)] },
      email: { rules: [validators.required("Email is required"), validators.email()] },
      phone: { rules: [validators.required("Phone is required"), validators.phone()] },
      zipCode: { rules: [validators.pattern(/^\d{5}(-\d{4})?$/, "Enter a valid ZIP code")] },
    },
    {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      zipCode: "",
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.validateAll()) {
      onSubmit(form.values as GuestInfo);
    }
  };

  return (
    <motion.div
      className={cn("space-y-6", className)}
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
      animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
    >
      {/* Header with guest checkout as primary */}
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold text-foreground">Almost there!</h2>
        <p className="text-sm text-muted-foreground">
          Complete your booking in under a minute
        </p>
      </div>

      {/* Trust badges */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Shield className="h-3.5 w-3.5 text-emerald-600" />
          <span>Secure checkout</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5 text-emerald-600" />
          <span>Instant confirmation</span>
        </div>
      </div>

      {/* Guest checkout form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name row */}
        <div className="grid grid-cols-2 gap-3">
          <ValidatedFormField
            label="First Name"
            name="firstName"
            placeholder="John"
            required
            autoComplete="given-name"
            {...form.getFieldProps("firstName")}
          />
          <ValidatedFormField
            label="Last Name"
            name="lastName"
            placeholder="Smith"
            required
            autoComplete="family-name"
            {...form.getFieldProps("lastName")}
          />
        </div>

        {/* Email with typo suggestions */}
        <EmailFormField
          label="Email"
          name="email"
          placeholder="hello@keeprstay.com"
          required
          {...form.getFieldProps("email")}
        />

        {/* Phone with auto-formatting */}
        <PhoneFormField
          label="Phone"
          name="phone"
          required
          {...form.getFieldProps("phone")}
        />

        {/* ZIP code */}
        <ValidatedFormField
          label="ZIP Code"
          name="zipCode"
          placeholder="12345"
          autoComplete="postal-code"
          hint="Optional - helps with weather alerts"
          {...form.getFieldProps("zipCode")}
        />

        {/* Submit button */}
        <Button
          type="submit"
          className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-base font-semibold"
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Processing...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Continue to Payment
            </span>
          )}
        </Button>

        {/* Security note */}
        <p className="text-xs text-center text-muted-foreground">
          Your information is encrypted and secure. We never share your data.
        </p>
      </form>

      {/* Sign in option - secondary */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-card px-3 text-muted-foreground">or</span>
        </div>
      </div>

      <div className="text-center">
        <button
          type="button"
          onClick={() => {
            if (onSignIn) onSignIn();
            else setShowSignIn(true);
          }}
          className="text-sm text-muted-foreground hover:text-emerald-600 transition-colors"
        >
          Already have an account?{" "}
          <span className="font-medium text-emerald-600 hover:underline">Sign in</span>
        </button>

        {/* Benefits of signing in - collapsed by default */}
        {showSignIn && !onSignIn && (
          <motion.div
            className="mt-4 p-4 bg-muted rounded-lg text-left"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
          >
            <p className="text-sm font-medium text-foreground mb-2">
              Benefits of signing in:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <span className="text-emerald-500">&#10003;</span>
                View all your reservations in one place
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-500">&#10003;</span>
                Faster checkout next time
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-500">&#10003;</span>
                Earn loyalty rewards
              </li>
            </ul>
            <Button
              type="button"
              variant="outline"
              className="w-full mt-3"
              onClick={onSignIn}
            >
              <User className="h-4 w-4 mr-2" />
              Sign In
            </Button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

// Compact version for step forms
export function GuestInfoSummary({
  guest,
  onEdit
}: {
  guest: GuestInfo;
  onEdit?: () => void;
}) {
  return (
    <div className="p-4 bg-muted rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Guest Information</h3>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="text-xs text-emerald-600 hover:underline"
          >
            Edit
          </button>
        )}
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-foreground">
          <User className="h-4 w-4 text-muted-foreground" />
          <span>
            {guest.firstName} {guest.lastName}
          </span>
        </div>
        <div className="flex items-center gap-2 text-foreground">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span>{guest.email}</span>
        </div>
        <div className="flex items-center gap-2 text-foreground">
          <Phone className="h-4 w-4 text-muted-foreground" />
          <span>{guest.phone}</span>
        </div>
        {guest.zipCode && (
          <div className="flex items-center gap-2 text-foreground">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>{guest.zipCode}</span>
          </div>
        )}
      </div>
    </div>
  );
}
