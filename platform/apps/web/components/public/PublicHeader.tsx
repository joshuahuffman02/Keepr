"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Menu,
    X,
    User,
    Settings,
    LogOut,
    Heart,
    Calendar,
    Building2,
    ChevronDown
} from "lucide-react";
import { useEasterEggs } from "@/contexts/EasterEggsContext";

// Extend session type to include campgrounds
interface ExtendedSession {
    user?: {
        id?: string;
        name?: string | null;
        email?: string | null;
        image?: string | null;
        platformRole?: string;
    };
    campgrounds?: Array<{ id: string; name: string }>;
}

const navLinks = [
    { label: "Campgrounds", href: "/campgrounds" },
    { label: "Book a stay", href: "/booking" },
    { label: "Help", href: "/help" }
];

export function PublicHeader() {
    const { data: session, status } = useSession() as { data: ExtendedSession | null; status: string };
    const [mobileOpen, setMobileOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const profileRef = useRef<HTMLDivElement>(null);
    const isLoading = status === "loading";
    const { handleLogoClick } = useEasterEggs();

    // Check if user has campground access (owner/manager)
    const hasCampgroundAccess = session?.campgrounds && session.campgrounds.length > 0;

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setProfileOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const closeMobile = () => setMobileOpen(false);

    // Get user initials for avatar
    const getInitials = (name?: string | null) => {
        if (!name) return "U";
        const parts = name.split(" ");
        if (parts.length >= 2) {
            return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    const ProfileDropdown = () => (
        <div ref={profileRef} className="relative">
            <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-full border border-slate-200 hover:shadow-md transition-all bg-white"
            >
                <Menu className="w-4 h-4 text-slate-500 ml-1" />
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-semibold">
                    {getInitials(session?.user?.name)}
                </div>
            </button>

            <AnimatePresence>
                {profileOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden z-50"
                    >
                        {/* User info section */}
                        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                            <p className="text-sm font-semibold text-slate-900">
                                {session?.user?.name || "Guest"}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                                {session?.user?.email}
                            </p>
                        </div>

                        {/* Menu items */}
                        <div className="py-2">
                            <Link
                                href="/trips"
                                onClick={() => setProfileOpen(false)}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                                <Calendar className="w-4 h-4 text-slate-400" />
                                My Trips
                            </Link>
                            <Link
                                href="/wishlists"
                                onClick={() => setProfileOpen(false)}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                                <Heart className="w-4 h-4 text-slate-400" />
                                Wishlists
                            </Link>
                            <Link
                                href="/account"
                                onClick={() => setProfileOpen(false)}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                                <Settings className="w-4 h-4 text-slate-400" />
                                Account Settings
                            </Link>
                        </div>

                        {/* Hosting section */}
                        <div className="border-t border-slate-100 py-2">
                            {hasCampgroundAccess ? (
                                <Link
                                    href="/dashboard"
                                    onClick={() => setProfileOpen(false)}
                                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 transition-colors"
                                >
                                    <Building2 className="w-4 h-4" />
                                    Manage your campground
                                </Link>
                            ) : (
                                <Link
                                    href="/host"
                                    onClick={() => setProfileOpen(false)}
                                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                    <Building2 className="w-4 h-4 text-slate-400" />
                                    Become a Host
                                </Link>
                            )}
                        </div>

                        {/* Sign out */}
                        <div className="border-t border-slate-100 py-2">
                            <button
                                onClick={() => {
                                    setProfileOpen(false);
                                    signOut({ callbackUrl: "/" });
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                                <LogOut className="w-4 h-4 text-slate-400" />
                                Sign Out
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );

    const authButtons = (
        <>
            {isLoading ? (
                <div className="w-24 h-10 bg-slate-100 rounded-lg animate-pulse" />
            ) : session ? (
                <div className="flex items-center gap-3">
                    {/* Switch to hosting button - only visible if user has campgrounds */}
                    {hasCampgroundAccess && (
                        <Link
                            href="/dashboard"
                            className="hidden lg:flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
                        >
                            Switch to hosting
                        </Link>
                    )}
                    <ProfileDropdown />
                </div>
            ) : (
                <>
                    <Link
                        href="/auth/signin"
                        className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all"
                    >
                        Sign In
                    </Link>
                    <Link
                        href="/signup"
                        className="px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg hover:from-emerald-500 hover:to-teal-500 transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30"
                    >
                        Start Free Trial
                    </Link>
                </>
            )}
        </>
    );

    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-white/85 backdrop-blur-xl border-b border-slate-200/60">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-3 group min-w-0" onClick={handleLogoClick}>
                    <div className="relative w-10 h-10 sm:w-12 sm:h-12 transition-transform group-hover:scale-105">
                        <Image
                            src="/logo.png"
                            alt="Camp Everyday"
                            fill
                            sizes="48px"
                            className="object-contain"
                            priority
                        />
                    </div>
                    <span className="text-lg sm:text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent truncate">
                        Camp Everyday
                    </span>
                </Link>

                {/* Right side buttons */}
                <div className="flex items-center gap-3">
                    <button
                        className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                        onClick={() => setMobileOpen((v) => !v)}
                        aria-label="Toggle menu"
                    >
                        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </button>
                    <div className="hidden md:flex items-center gap-3">{authButtons}</div>
                </div>
            </div>

            {/* Mobile menu */}
            <AnimatePresence>
                {mobileOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="md:hidden border-t border-slate-200 bg-white shadow-lg overflow-hidden"
                    >
                        <nav className="px-4 py-4 space-y-3">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className="block rounded-lg px-3 py-3 text-base font-medium text-slate-800 hover:bg-slate-50"
                                    onClick={closeMobile}
                                >
                                    {link.label}
                                </Link>
                            ))}

                            {/* Mobile: Show hosting link if applicable */}
                            {session && hasCampgroundAccess && (
                                <Link
                                    href="/dashboard"
                                    className="flex items-center gap-2 rounded-lg px-3 py-3 text-base font-medium text-emerald-700 bg-emerald-50"
                                    onClick={closeMobile}
                                >
                                    <Building2 className="w-5 h-5" />
                                    Switch to hosting
                                </Link>
                            )}

                            <div className="pt-2 space-y-2 border-t border-slate-100">
                                {isLoading ? (
                                    <div className="w-full h-12 bg-slate-100 rounded-lg animate-pulse" />
                                ) : session ? (
                                    <>
                                        <div className="flex items-center gap-3 px-3 py-2">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-semibold">
                                                {getInitials(session?.user?.name)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900">
                                                    {session?.user?.name || "Guest"}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {session?.user?.email}
                                                </p>
                                            </div>
                                        </div>
                                        <Link
                                            href="/trips"
                                            className="block rounded-lg px-3 py-3 text-base font-medium text-slate-700 hover:bg-slate-50"
                                            onClick={closeMobile}
                                        >
                                            My Trips
                                        </Link>
                                        <Link
                                            href="/wishlists"
                                            className="block rounded-lg px-3 py-3 text-base font-medium text-slate-700 hover:bg-slate-50"
                                            onClick={closeMobile}
                                        >
                                            Wishlists
                                        </Link>
                                        <Link
                                            href="/account"
                                            className="block rounded-lg px-3 py-3 text-base font-medium text-slate-700 hover:bg-slate-50"
                                            onClick={closeMobile}
                                        >
                                            Account Settings
                                        </Link>
                                        <button
                                            onClick={() => {
                                                closeMobile();
                                                signOut({ callbackUrl: "/" });
                                            }}
                                            className="w-full text-left rounded-lg px-3 py-3 text-base font-medium text-slate-700 hover:bg-slate-50"
                                        >
                                            Sign Out
                                        </button>
                                    </>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        <Link
                                            href="/auth/signin"
                                            className="block text-center px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                                            onClick={closeMobile}
                                        >
                                            Sign In
                                        </Link>
                                        <Link
                                            href="/signup"
                                            className="block text-center px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg"
                                            onClick={closeMobile}
                                        >
                                            Start Free Trial
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </nav>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
}
