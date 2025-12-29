import Link from "next/link";
import { Compass, Home, Search, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 px-4">
      <div className="text-center max-w-md">
        {/* Icon */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <Compass className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
        </div>

        {/* 404 Badge */}
        <span className="inline-block px-3 py-1 mb-4 text-sm font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/50 rounded-full">
          404
        </span>

        {/* Headline */}
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
          Page not found
        </h1>

        {/* Description */}
        <p className="text-slate-600 dark:text-slate-400 mb-8">
          Looks like you've wandered off the trail. The page you're looking for
          doesn't exist or may have been moved.
        </p>

        {/* Primary CTA */}
        <Link href="/">
          <Button size="lg" className="mb-4 w-full sm:w-auto">
            <Home className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        {/* Secondary Links */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-sm">
          <Link
            href="/dashboard"
            className="text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1.5 transition-colors"
          >
            <Search className="w-4 h-4" />
            Go to Dashboard
          </Link>
          <span className="hidden sm:inline text-slate-300 dark:text-slate-700">
            |
          </span>
          <Link
            href="/help"
            className="text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1.5 transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
            Get Help
          </Link>
        </div>
      </div>
    </div>
  );
}
