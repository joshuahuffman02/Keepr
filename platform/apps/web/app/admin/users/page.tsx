"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useWhoami } from "@/hooks/use-whoami";
import { useToast } from "@/components/ui/use-toast";
import { Shield, User, Search, Building2 } from "lucide-react";

type Staff = {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    region?: string | null;
    platformRole?: string | null;
    platformRegion?: string | null;
    platformActive?: boolean | null;
    memberships?: Array<{ campgroundId: string; role: string }>;
};

interface UserWithPlatformRole {
    platformRole?: string | null;
}

export default function AdminUsersPage() {
    const { data: whoami, isLoading: whoamiLoading } = useWhoami();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState<Staff[]>([]);
    const [search, setSearch] = useState("");

    const platformRole = (whoami?.user as UserWithPlatformRole | undefined)?.platformRole;
    const canManage = platformRole === "platform_admin";

    const filteredUsers = useMemo(() => {
        if (!search.trim()) return users;
        const q = search.toLowerCase();
        return users.filter(
            (u) =>
                u.email.toLowerCase().includes(q) ||
                `${u.firstName ?? ""} ${u.lastName ?? ""}`.toLowerCase().includes(q)
        );
    }, [search, users]);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const base = process.env.NEXT_PUBLIC_API_BASE || "";
            const res = await fetch(`${base}/support/reports/staff/directory`, { credentials: "include" });
            if (!res.ok) throw new Error(`Failed to load users (${res.status})`);
            const data = (await res.json()) as Staff[];
            // No filter - show all
            setUsers(data);
        } catch (err: any) {
            toast({ title: "Load failed", description: err?.message || "Could not load users", variant: "destructive" });
            setUsers([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (whoamiLoading || !canManage) return;
        void loadUsers();
    }, [whoamiLoading, canManage]);

    if (!whoamiLoading && !canManage) {
        return (
            <div className="p-8 text-center bg-slate-800 rounded-lg border border-slate-700">
                <Shield className="h-10 w-10 text-slate-500 mx-auto mb-3" />
                <h2 className="text-xl font-semibold text-slate-200">Access Restricted</h2>
                <p className="text-slate-400">You must be a Platform Admin to view this directory.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                        <User className="h-6 w-6 text-blue-400" />
                        User Directory
                    </h1>
                    <p className="text-sm text-slate-400">Manage all users registered on the platform.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search name or email..."
                            className="pl-9 h-9 w-64 bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500"
                        />
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => void loadUsers()} disabled={loading}>
                        Refresh
                    </Button>
                </div>
            </div>

            <Card className="bg-slate-900 border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-950 text-xs uppercase font-semibold text-slate-500 border-b border-slate-800">
                            <tr>
                                <th className="px-4 py-3">User</th>
                                <th className="px-4 py-3">Role</th>
                                <th className="px-4 py-3">Campgrounds</th>
                                <th className="px-4 py-3">Active</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {loading ? (
                                <tr><td colSpan={4} className="p-8 text-center text-slate-500">Loading users...</td></tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr><td colSpan={4} className="p-8 text-center text-slate-500">No users found.</td></tr>
                            ) : (
                                filteredUsers.map(user => (
                                    <tr key={user.id} className="hover:bg-slate-800/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-slate-200">
                                                {(user.firstName || user.lastName) ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : "—"}
                                            </div>
                                            <div className="text-xs text-slate-500">{user.email}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {user.platformRole ? (
                                                <Badge className="bg-status-info/15 text-status-info hover:bg-status-info/20 border-status-info/30">
                                                    {user.platformRole.replace('_', ' ')}
                                                </Badge>
                                            ) : (
                                                <span className="text-slate-600">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {user.memberships && user.memberships.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {user.memberships.length} associated
                                                </div>
                                            ) : (
                                                <span className="text-slate-600">None</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge variant="outline" className={user.platformActive !== false ? "text-emerald-400 border-emerald-400/20" : "text-rose-400 border-rose-400/20"}>
                                                {user.platformActive !== false ? "Active" : "Inactive"}
                                            </Badge>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
