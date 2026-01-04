"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Logo, LogoImage } from "@/components/brand";
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
    ChevronDown,
    Compass,
    MapPin,
    Mountain,
    Trees,
    Tent,
    Waves
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

// Popular destinations for the Explore dropdown
const exploreDestinations = [
    { name: "Yosemite", slug: "yosemite-national-park", icon: Mountain },
    { name: "Yellowstone", slug: "yellowstone-national-park", icon: Trees },
    { name: "Grand Canyon", slug: "grand-canyon-national-park", icon: Mountain },
    { name: "Zion", slug: "zion-national-park", icon: Mountain },
    { name: "Joshua Tree", slug: "joshua-tree-national-park", icon: Tent },
    { name: "Acadia", slug: "acadia-national-park", icon: Waves },
];

const popularStates = [
    { name: "California", slug: "california" },
    { name: "Colorado", slug: "colorado" },
    { name: "Utah", slug: "utah" },
    { name: "Arizona", slug: "arizona" },
    { name: "Florida", slug: "florida" },
    { name: "Texas", slug: "texas" },
];

export function PublicHeader() {
    const { data: session, status } = useSession() as { data: ExtendedSession | null; status: string };
    const [mobileOpen, setMobileOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [exploreOpen, setExploreOpen] = useState(false);
    const profileRef = useRef<HTMLDivElement>(null);
    const exploreRef = useRef<HTMLDivElement>(null);
    const isLoading = status === "loading";
    const { handleLogoClick } = useEasterEggs();

    // Check if user has campground access (owner/manager)
    const hasCampgroundAccess = session?.campgrounds && session.campgrounds.length > 0;

    // Close dropdowns when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setProfileOpen(false);
            }
            if (exploreRef.current && !exploreRef.current.contains(event.target as Node)) {
                setExploreOpen(false);
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

    const ExploreDropdown = () => (
        <div ref={exploreRef} className="relative">
            <button
                onClick={() => setExploreOpen(!exploreOpen)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-full transition-colors"
            >
                <Compass className="w-4 h-4" />
                Explore
                <ChevronDown className={`w-4 h-4 transition-transform ${exploreOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {exploreOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 mt-2 w-80 bg-card rounded-xl shadow-lg border border-border overflow-hidden z-50"
                    >
                        {/* Browse All */}
                        <div className="p-3 border-b border-border">
                            <Link
                                href="/camping"
                                onClick={() => setExploreOpen(false)}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 transition-colors"
                            >
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                                    <MapPin className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-foreground">Browse All Campgrounds</p>
                                    <p className="text-xs text-muted-foreground">Explore by state, region, or amenity</p>
                                </div>
                            </Link>
                        </div>

                        {/* Popular Destinations */}
                        <div className="p-3">
                            <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Popular Destinations</p>
                            <div className="grid grid-cols-2 gap-1">
                                {exploreDestinations.map((dest) => {
                                    const Icon = dest.icon;
                                    return (
                                        <Link
                                            key={dest.slug}
                                            href={`/near/${dest.slug}`}
                                            onClick={() => setExploreOpen(false)}
                                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
                                        >
                                            <Icon className="w-4 h-4 text-muted-foreground" />
                                            {dest.name}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Popular States */}
                        <div className="p-3 border-t border-border">
                            <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">By State</p>
                            <div className="grid grid-cols-3 gap-1">
                                {popularStates.map((state) => (
                                    <Link
                                        key={state.slug}
                                        href={`/camping/${state.slug}`}
                                        onClick={() => setExploreOpen(false)}
                                        className="px-3 py-2 rounded-lg text-sm text-foreground hover:bg-muted transition-colors text-center"
                                    >
                                        {state.name}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );

    const ProfileDropdown = () => (
        <div ref={profileRef} className="relative">
            <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-full border border-border hover:shadow-md transition-all bg-card"
            >
                <Menu className="w-4 h-4 text-muted-foreground ml-1" />
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
                        className="absolute right-0 mt-2 w-64 bg-card rounded-xl shadow-lg border border-border overflow-hidden z-50"
                    >
                        {/* User info section */}
                        <div className="px-4 py-3 border-b border-border bg-muted">
                            <p className="text-sm font-semibold text-foreground">
                                {session?.user?.name || "Guest"}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                                {session?.user?.email}
                            </p>
                        </div>

                        {/* Menu items */}
                        <div className="py-2">
                            <Link
                                href="/trips"
                                onClick={() => setProfileOpen(false)}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                            >
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                My Trips
                            </Link>
                            <Link
                                href="/wishlists"
                                onClick={() => setProfileOpen(false)}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                            >
                                <Heart className="w-4 h-4 text-muted-foreground" />
                                Wishlists
                            </Link>
                            <Link
                                href="/account"
                                onClick={() => setProfileOpen(false)}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                            >
                                <Settings className="w-4 h-4 text-muted-foreground" />
                                Account Settings
                            </Link>
                        </div>

                        {/* Hosting section */}
                        <div className="border-t border-border py-2">
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
                                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                                >
                                    <Building2 className="w-4 h-4 text-muted-foreground" />
                                    Become a Host
                                </Link>
                            )}
                        </div>

                        {/* Sign out */}
                        <div className="border-t border-border py-2">
                            <button
                                onClick={() => {
                                    setProfileOpen(false);
                                    signOut({ callbackUrl: "/" });
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                            >
                                <LogOut className="w-4 h-4 text-muted-foreground" />
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
                <div className="w-24 h-10 bg-muted rounded-lg animate-pulse" />
            ) : session ? (
                <div className="flex items-center gap-3">
                    {/* Switch to hosting button - only visible if user has campgrounds */}
                    {hasCampgroundAccess && (
                        <Link
                            href="/dashboard"
                            className="hidden lg:flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-full transition-colors"
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
                        className="px-4 py-2.5 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-muted hover:border-border transition-all"
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
        <header className="fixed top-0 left-0 right-0 z-50 bg-card/85 backdrop-blur-xl border-b border-border/60">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
                {/* Logo */}
                <Link href="/" className="flex items-center group" onClick={handleLogoClick}>
                    <LogoImage size="2xl" className="transition-transform group-hover:scale-105" />
                </Link>

                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center gap-2">
                    <ExploreDropdown />
                </div>

                {/* Right side buttons */}
                <div className="flex items-center gap-3">
                    <button
                        className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors"
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
                        className="md:hidden border-t border-border bg-card shadow-lg overflow-hidden"
                    >
                        <nav className="px-4 py-4 space-y-3">
                            {/* Explore Section */}
                            <div className="pb-3 border-b border-border">
                                <Link
                                    href="/camping"
                                    className="flex items-center gap-3 rounded-lg px-3 py-3 bg-gradient-to-r from-emerald-50 to-teal-50"
                                    onClick={closeMobile}
                                >
                                    <Compass className="w-5 h-5 text-emerald-600" />
                                    <div>
                                        <p className="text-base font-medium text-foreground">Explore Campgrounds</p>
                                        <p className="text-xs text-muted-foreground">Browse all states & destinations</p>
                                    </div>
                                </Link>

                                {/* Popular destinations */}
                                <div className="mt-2 grid grid-cols-2 gap-1">
                                    {exploreDestinations.slice(0, 4).map((dest) => {
                                        const Icon = dest.icon;
                                        return (
                                            <Link
                                                key={dest.slug}
                                                href={`/near/${dest.slug}`}
                                                onClick={closeMobile}
                                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted"
                                            >
                                                <Icon className="w-4 h-4 text-muted-foreground" />
                                                {dest.name}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>

                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className="block rounded-lg px-3 py-3 text-base font-medium text-foreground hover:bg-muted"
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

                            <div className="pt-2 space-y-2 border-t border-border">
                                {isLoading ? (
                                    <div className="w-full h-12 bg-muted rounded-lg animate-pulse" />
                                ) : session ? (
                                    <>
                                        <div className="flex items-center gap-3 px-3 py-2">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-semibold">
                                                {getInitials(session?.user?.name)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-foreground">
                                                    {session?.user?.name || "Guest"}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {session?.user?.email}
                                                </p>
                                            </div>
                                        </div>
                                        <Link
                                            href="/trips"
                                            className="block rounded-lg px-3 py-3 text-base font-medium text-foreground hover:bg-muted"
                                            onClick={closeMobile}
                                        >
                                            My Trips
                                        </Link>
                                        <Link
                                            href="/wishlists"
                                            className="block rounded-lg px-3 py-3 text-base font-medium text-foreground hover:bg-muted"
                                            onClick={closeMobile}
                                        >
                                            Wishlists
                                        </Link>
                                        <Link
                                            href="/account"
                                            className="block rounded-lg px-3 py-3 text-base font-medium text-foreground hover:bg-muted"
                                            onClick={closeMobile}
                                        >
                                            Account Settings
                                        </Link>
                                        <button
                                            onClick={() => {
                                                closeMobile();
                                                signOut({ callbackUrl: "/" });
                                            }}
                                            className="w-full text-left rounded-lg px-3 py-3 text-base font-medium text-foreground hover:bg-muted"
                                        >
                                            Sign Out
                                        </button>
                                    </>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        <Link
                                            href="/auth/signin"
                                            className="block text-center px-4 py-2.5 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-muted"
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
