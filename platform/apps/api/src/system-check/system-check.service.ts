import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface SystemCheckIssue {
    id: string;
    severity: 'error' | 'warning' | 'info';
    category: 'pricing' | 'bookings' | 'access' | 'property' | 'system';
    message: string;
    description: string;
    actionLabel: string;
    actionHref: string;
}

@Injectable()
export class SystemCheckService {
    constructor(private readonly prisma: PrismaService) { }

    async runCheck(campgroundId: string): Promise<SystemCheckIssue[]> {
        const issues: SystemCheckIssue[] = [];
        let issueId = 0;

        // Fetch campground with related data
        const campground = await this.prisma.campground.findUnique({
            where: { id: campgroundId },
            include: {
                sites: true,
                siteClasses: true,
                taxRules: { where: { isActive: true } },
                paymentGatewayConfig: true,
            },
        });

        if (!campground) {
            return [{
                id: '0',
                severity: 'error',
                category: 'system',
                message: 'Campground not found',
                description: 'The specified campground does not exist.',
                actionLabel: 'Contact Support',
                actionHref: '/support',
            }];
        }

        // === PRICING CHECKS ===

        // Check for Stripe configuration
        if (!campground.stripeAccountId) {
            issues.push({
                id: `${++issueId}`,
                severity: 'error',
                category: 'pricing',
                message: 'Payment processing not configured',
                description: 'Stripe account is not connected. You won\'t be able to accept payments.',
                actionLabel: 'Connect Stripe',
                actionHref: '/dashboard/settings/central/pricing/payments',
            });
        }

        // Check for tax rules
        if (campground.taxRules.length === 0) {
            issues.push({
                id: `${++issueId}`,
                severity: 'warning',
                category: 'pricing',
                message: 'No tax rules configured',
                description: 'Configure tax rules to ensure proper tax collection on reservations.',
                actionLabel: 'Add Tax Rules',
                actionHref: '/dashboard/settings/central/pricing/taxes',
            });
        }

        // === BOOKINGS CHECKS ===

        // Check for sites
        if (campground.sites.length === 0) {
            issues.push({
                id: `${++issueId}`,
                severity: 'error',
                category: 'bookings',
                message: 'No sites configured',
                description: 'Add sites to your campground to start accepting reservations.',
                actionLabel: 'Add Sites',
                actionHref: '/dashboard/settings/central/property/sites',
            });
        }

        // Check for site classes
        if (campground.siteClasses.length === 0) {
            issues.push({
                id: `${++issueId}`,
                severity: 'warning',
                category: 'bookings',
                message: 'No site classes defined',
                description: 'Define site classes to organize your sites and set pricing.',
                actionLabel: 'Add Site Classes',
                actionHref: '/dashboard/settings/central/property/site-classes',
            });
        }

        // Check booking page status
        if (!campground.isPublished) {
            issues.push({
                id: `${++issueId}`,
                severity: 'info',
                category: 'bookings',
                message: 'Public booking page not published',
                description: 'Your booking page is not visible to guests. Publish it when ready.',
                actionLabel: 'Review Settings',
                actionHref: '/dashboard/settings/central/bookings/online',
            });
        }

        // === PROPERTY CHECKS ===

        // Check for basic property info
        if (!campground.address1 || !campground.city || !campground.state) {
            issues.push({
                id: `${++issueId}`,
                severity: 'warning',
                category: 'property',
                message: 'Incomplete address information',
                description: 'Add your complete address for guest communications and invoices.',
                actionLabel: 'Update Address',
                actionHref: '/dashboard/settings/central/property/details',
            });
        }

        if (!campground.phone) {
            issues.push({
                id: `${++issueId}`,
                severity: 'info',
                category: 'property',
                message: 'No phone number configured',
                description: 'Add a contact phone number for guest inquiries.',
                actionLabel: 'Add Phone',
                actionHref: '/dashboard/settings/central/property/details',
            });
        }

        if (!campground.email) {
            issues.push({
                id: `${++issueId}`,
                severity: 'warning',
                category: 'property',
                message: 'No email address configured',
                description: 'Add an email address to receive booking notifications.',
                actionLabel: 'Add Email',
                actionHref: '/dashboard/settings/central/property/details',
            });
        }

        // Check for timezone
        if (!campground.timezone || campground.timezone === 'UTC') {
            issues.push({
                id: `${++issueId}`,
                severity: 'warning',
                category: 'property',
                message: 'Timezone not configured',
                description: 'Set your local timezone for accurate check-in/check-out times.',
                actionLabel: 'Set Timezone',
                actionHref: '/dashboard/settings/central/property/details',
            });
        }

        // === ACCESS CHECKS ===

        // Check for check-in/out times
        if (!campground.checkInTime || !campground.checkOutTime) {
            issues.push({
                id: `${++issueId}`,
                severity: 'info',
                category: 'access',
                message: 'Check-in/out times not set',
                description: 'Configure check-in and check-out times for guest communications.',
                actionLabel: 'Set Times',
                actionHref: '/dashboard/settings/central/bookings/operations',
            });
        }

        // === SYSTEM CHECKS ===

        // Check for logo
        if (!campground.logoUrl) {
            issues.push({
                id: `${++issueId}`,
                severity: 'info',
                category: 'system',
                message: 'No logo uploaded',
                description: 'Add your logo for a professional appearance on emails and receipts.',
                actionLabel: 'Upload Logo',
                actionHref: '/dashboard/settings/central/property/branding',
            });
        }

        return issues;
    }
}
