import { Guest } from "@campreserv/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Phone, MapPin, User, ExternalLink } from "lucide-react";
import Link from "next/link";

interface GuestCardProps {
    guest: Guest;
}

export function GuestCard({ guest }: GuestCardProps) {
    const guestWithTimestamp = guest as Guest & { createdAt?: string };
    const createdYear = guestWithTimestamp.createdAt ? new Date(guestWithTimestamp.createdAt).getFullYear() : "—";
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <User className="w-5 h-5 text-slate-500" />
                    Guest Details
                </CardTitle>
                <Link
                    href={`/guests/${guest.id}`}
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                    View Profile <ExternalLink className="w-3 h-3" />
                </Link>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <Link
                        href={`/guests/${guest.id}`}
                        className="font-semibold text-slate-900 text-lg hover:text-blue-600 transition-colors"
                    >
                        {guest.primaryFirstName} {guest.primaryLastName}
                    </Link>
                    <div className="text-sm text-slate-500">Guest since {createdYear}</div>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center gap-3 text-slate-600">
                        <Mail className="w-4 h-4" />
                        <a href={`mailto:${guest.email}`} className="hover:text-blue-600 transition-colors">
                            {guest.email}
                        </a>
                    </div>
                    <div className="flex items-center gap-3 text-slate-600">
                        <Phone className="w-4 h-4" />
                        <a href={`tel:${guest.phone}`} className="hover:text-blue-600 transition-colors">
                            {guest.phone}
                        </a>
                    </div>
                    {(guest.city || guest.state) && (
                        <div className="flex items-center gap-3 text-slate-600">
                            <MapPin className="w-4 h-4" />
                            <span>
                                {[guest.city, guest.state].filter(Boolean).join(", ")}
                            </span>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
