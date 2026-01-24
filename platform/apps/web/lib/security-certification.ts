/**
 * Security & Privacy Certification System (CISO-level)
 *
 * This certification focuses on what CAMPGROUND OPERATORS control.
 * Platform-level protections (encryption, infrastructure) are handled by Campreserv
 * and displayed separately as "Protected by Campreserv".
 *
 * References:
 * - NIST: https://www.nist.gov/cyberframework
 * - CIS Controls: https://www.cisecurity.org/controls
 * - FTC Small Business: https://www.ftc.gov/business-guidance/small-businesses/cybersecurity
 */

export type SecurityCertificationLevel = "none" | "basic" | "standard" | "advanced" | "excellence";

export interface SecurityChecklistItem {
  id: string;
  category: SecurityCategory;
  label: string;
  description: string;
  required: boolean;
  points: number;
  templateId?: string;
  resourceUrl?: string;
}

export interface PlatformProtection {
  id: string;
  label: string;
  description: string;
  icon: "shield" | "lock" | "server" | "database" | "key";
}

export type SecurityCategory =
  | "access_management"
  | "physical_security"
  | "employee_training"
  | "incident_response"
  | "privacy_practices"
  | "vendor_management";

export const SECURITY_CATEGORIES: Record<SecurityCategory, { label: string; description: string }> =
  {
    access_management: {
      label: "Access Management",
      description: "How you manage who can access your Campreserv account",
    },
    physical_security: {
      label: "Physical Security",
      description: "Protecting devices, documents, and your physical workspace",
    },
    employee_training: {
      label: "Employee Training",
      description: "Security awareness and education for your staff",
    },
    incident_response: {
      label: "Incident Response",
      description: "Your procedures for handling security incidents",
    },
    privacy_practices: {
      label: "Privacy Practices",
      description: "How you handle guest privacy and data requests",
    },
    vendor_management: {
      label: "Vendor Management",
      description: "Managing third-party services that access your data",
    },
  };

const SECURITY_CATEGORY_KEYS: SecurityCategory[] = [
  "access_management",
  "physical_security",
  "employee_training",
  "incident_response",
  "privacy_practices",
  "vendor_management",
];

/**
 * Platform Protections - Handled by Campreserv
 * These are always active and not configurable by campground operators
 */
export const PLATFORM_PROTECTIONS: PlatformProtection[] = [
  {
    id: "platform_encryption_rest",
    label: "Data Encryption at Rest",
    description: "All customer data is encrypted in our database using AES-256",
    icon: "database",
  },
  {
    id: "platform_encryption_transit",
    label: "Data Encryption in Transit",
    description: "All connections use TLS 1.3 encryption (HTTPS)",
    icon: "lock",
  },
  {
    id: "platform_pci",
    label: "PCI-DSS Compliance",
    description: "Payment processing through Stripe, a PCI Level 1 certified provider",
    icon: "shield",
  },
  {
    id: "platform_backups",
    label: "Automated Encrypted Backups",
    description: "Daily encrypted backups with 30-day retention",
    icon: "server",
  },
  {
    id: "platform_logging",
    label: "Security Event Logging",
    description: "All access and changes are logged with tamper-proof audit trails",
    icon: "server",
  },
  {
    id: "platform_infrastructure",
    label: "Secure Infrastructure",
    description: "Hosted on Railway with enterprise-grade firewalls and DDoS protection",
    icon: "shield",
  },
  {
    id: "platform_session",
    label: "Secure Session Management",
    description: "Automatic session timeouts and secure token handling",
    icon: "key",
  },
  {
    id: "platform_passwords",
    label: "Password Security",
    description: "Passwords hashed with bcrypt, minimum 12 characters required",
    icon: "lock",
  },
];

/**
 * Security Checklist Items - Campground Operator Responsibilities
 * These are things the campground controls, not the platform
 */
export const SECURITY_CHECKLIST: SecurityChecklistItem[] = [
  // Access Management (7 items)
  {
    id: "access_unique_accounts",
    category: "access_management",
    label: "Unique user accounts for each employee",
    description: "Each staff member has their own login - no shared accounts",
    required: true,
    points: 12,
  },
  {
    id: "access_mfa_enabled",
    category: "access_management",
    label: "Multi-factor authentication enabled",
    description: "MFA is turned on for all user accounts in your organization",
    required: true,
    points: 15,
  },
  {
    id: "access_roles_configured",
    category: "access_management",
    label: "User roles properly configured",
    description: "Staff have appropriate permission levels (not everyone is admin)",
    required: true,
    points: 10,
  },
  {
    id: "access_reviews_quarterly",
    category: "access_management",
    label: "Quarterly access reviews",
    description: "Review who has access to your account at least every 90 days",
    required: false,
    points: 8,
  },
  {
    id: "access_offboarding",
    category: "access_management",
    label: "Immediate offboarding procedure",
    description: "Documented process to revoke access when employees leave",
    required: true,
    points: 12,
    templateId: "offboarding-checklist",
  },
  {
    id: "access_onboarding",
    category: "access_management",
    label: "Security onboarding for new hires",
    description: "New employees receive security training before getting access",
    required: true,
    points: 10,
    templateId: "onboarding-checklist",
  },
  {
    id: "access_password_policy",
    category: "access_management",
    label: "Password policy communicated",
    description: "Staff know not to reuse passwords or share credentials",
    required: false,
    points: 6,
    templateId: "password-policy",
  },

  // Physical Security (6 items)
  {
    id: "physical_device_locks",
    category: "physical_security",
    label: "Devices lock automatically",
    description: "Computers and tablets lock after brief inactivity",
    required: true,
    points: 8,
  },
  {
    id: "physical_secure_storage",
    category: "physical_security",
    label: "Secure device storage",
    description: "Laptops and devices stored securely when office is closed",
    required: true,
    points: 8,
  },
  {
    id: "physical_document_disposal",
    category: "physical_security",
    label: "Secure document disposal",
    description: "Guest info and financial documents are shredded, not trashed",
    required: true,
    points: 10,
  },
  {
    id: "physical_clean_desk",
    category: "physical_security",
    label: "Clean desk policy",
    description: "Sensitive documents not left visible on desks",
    required: false,
    points: 5,
  },
  {
    id: "physical_visitor_policy",
    category: "physical_security",
    label: "Visitor access policy",
    description: "Non-employees don't have unsupervised access to computers",
    required: false,
    points: 6,
  },
  {
    id: "physical_wifi_separate",
    category: "physical_security",
    label: "Separate guest and business WiFi",
    description: "Guest WiFi network is separate from your office network",
    required: true,
    points: 10,
  },

  // Employee Training (5 items)
  {
    id: "training_security_annual",
    category: "employee_training",
    label: "Annual security awareness training",
    description: "All staff complete security training at least yearly",
    required: true,
    points: 15,
    templateId: "security-training-checklist",
    resourceUrl: "https://www.cisa.gov/free-cybersecurity-services-and-tools",
  },
  {
    id: "training_phishing",
    category: "employee_training",
    label: "Phishing awareness training",
    description: "Staff trained to recognize and report suspicious emails",
    required: true,
    points: 12,
    resourceUrl: "https://www.ftc.gov/business-guidance/small-businesses/cybersecurity/phishing",
  },
  {
    id: "training_new_hire",
    category: "employee_training",
    label: "New hire security orientation",
    description: "Security policies covered during employee onboarding",
    required: true,
    points: 10,
    templateId: "onboarding-checklist",
  },
  {
    id: "training_social_engineering",
    category: "employee_training",
    label: "Social engineering awareness",
    description: "Staff know not to give out info to unverified callers",
    required: false,
    points: 8,
  },
  {
    id: "training_incident_reporting",
    category: "employee_training",
    label: "Incident reporting training",
    description: "Staff know who to contact and what to do if something seems wrong",
    required: true,
    points: 8,
  },

  // Incident Response (5 items)
  {
    id: "incident_plan",
    category: "incident_response",
    label: "Incident response plan documented",
    description: "Written plan for what to do if there's a security incident",
    required: true,
    points: 15,
    templateId: "incident-response-plan",
  },
  {
    id: "incident_contact",
    category: "incident_response",
    label: "Security contact designated",
    description: "Specific person responsible for security issues",
    required: true,
    points: 8,
  },
  {
    id: "incident_notification",
    category: "incident_response",
    label: "Breach notification procedure",
    description: "Know how and when to notify guests if their data is compromised",
    required: true,
    points: 10,
    templateId: "breach-notification-template",
  },
  {
    id: "incident_backup_tested",
    category: "incident_response",
    label: "Data export/backup tested",
    description: "You've tested exporting your data from Campreserv",
    required: false,
    points: 8,
  },
  {
    id: "incident_review_process",
    category: "incident_response",
    label: "Post-incident review process",
    description: "Learn from incidents to prevent them from happening again",
    required: false,
    points: 6,
  },

  // Privacy Practices (6 items)
  {
    id: "privacy_policy_posted",
    category: "privacy_practices",
    label: "Privacy policy on website",
    description: "Clear privacy policy available on your campground website",
    required: true,
    points: 12,
    templateId: "privacy-policy",
  },
  {
    id: "privacy_consent_documented",
    category: "privacy_practices",
    label: "Marketing consent documented",
    description: "You have records of guests opting in to marketing emails",
    required: true,
    points: 8,
  },
  {
    id: "privacy_data_requests",
    category: "privacy_practices",
    label: "Data request process",
    description: "You can handle guest requests to see or delete their data",
    required: true,
    points: 10,
    templateId: "data-subject-request-form",
  },
  {
    id: "privacy_retention_policy",
    category: "privacy_practices",
    label: "Data retention policy",
    description: "Documented policy for how long you keep guest data",
    required: false,
    points: 8,
    templateId: "data-retention-policy",
  },
  {
    id: "privacy_third_party_disclosure",
    category: "privacy_practices",
    label: "Third-party sharing disclosed",
    description: "Guests informed about data shared with partners",
    required: false,
    points: 6,
  },
  {
    id: "privacy_optout_easy",
    category: "privacy_practices",
    label: "Easy marketing opt-out",
    description: "One-click unsubscribe available on all marketing emails",
    required: true,
    points: 6,
  },

  // Vendor Management (4 items)
  {
    id: "vendor_inventory",
    category: "vendor_management",
    label: "Vendor inventory maintained",
    description: "List of all services that have access to your data (booking sites, etc.)",
    required: true,
    points: 8,
  },
  {
    id: "vendor_security_review",
    category: "vendor_management",
    label: "Vendor security reviewed",
    description: "You've checked that key vendors have reasonable security",
    required: false,
    points: 10,
    templateId: "vendor-security-questionnaire",
  },
  {
    id: "vendor_contracts",
    category: "vendor_management",
    label: "Data processing agreements",
    description: "Contracts with vendors specify how they must protect your data",
    required: false,
    points: 10,
    templateId: "data-processing-agreement",
  },
  {
    id: "vendor_access_minimal",
    category: "vendor_management",
    label: "Minimal vendor access",
    description: "Third parties only have access they actually need",
    required: false,
    points: 6,
  },
];

/**
 * Certification level thresholds
 */
export const SECURITY_CERTIFICATION_THRESHOLDS = {
  basic: {
    minPoints: 50,
    requiredItemsRatio: 0.3,
    label: "Basic Security",
    description: "Foundational security practices in place",
    badgeColor: "from-amber-600 to-amber-700",
  },
  standard: {
    minPoints: 100,
    requiredItemsRatio: 0.6,
    label: "Standard Security",
    description: "Strong security practices implemented",
    badgeColor: "from-slate-400 to-slate-500",
  },
  advanced: {
    minPoints: 160,
    requiredItemsRatio: 0.85,
    label: "Advanced Security",
    description: "Comprehensive security program in place",
    badgeColor: "from-yellow-400 to-amber-500",
  },
  excellence: {
    minPoints: 220,
    requiredItemsRatio: 1.0,
    label: "Security Excellence",
    description: "Industry-leading security and privacy practices",
    badgeColor: "from-cyan-400 to-blue-500",
  },
};

export interface SecurityAssessmentData {
  completedItems: string[];
  notes?: string;
  lastUpdated?: string;
}

export interface SecurityAuditorInfo {
  verified: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
  auditorEmail?: string;
  auditorOrg?: string;
}

/**
 * Calculate certification level based on assessment data
 */
export function calculateSecurityCertificationLevel(
  assessment: SecurityAssessmentData,
): SecurityCertificationLevel {
  const completedSet = new Set(assessment.completedItems);

  const totalPoints = SECURITY_CHECKLIST.filter((item) => completedSet.has(item.id)).reduce(
    (sum, item) => sum + item.points,
    0,
  );

  const requiredItems = SECURITY_CHECKLIST.filter((item) => item.required);
  const completedRequired = requiredItems.filter((item) => completedSet.has(item.id));
  const requiredRatio =
    requiredItems.length > 0 ? completedRequired.length / requiredItems.length : 0;

  if (
    totalPoints >= SECURITY_CERTIFICATION_THRESHOLDS.excellence.minPoints &&
    requiredRatio >= SECURITY_CERTIFICATION_THRESHOLDS.excellence.requiredItemsRatio
  ) {
    return "excellence";
  }

  if (
    totalPoints >= SECURITY_CERTIFICATION_THRESHOLDS.advanced.minPoints &&
    requiredRatio >= SECURITY_CERTIFICATION_THRESHOLDS.advanced.requiredItemsRatio
  ) {
    return "advanced";
  }

  if (
    totalPoints >= SECURITY_CERTIFICATION_THRESHOLDS.standard.minPoints &&
    requiredRatio >= SECURITY_CERTIFICATION_THRESHOLDS.standard.requiredItemsRatio
  ) {
    return "standard";
  }

  if (
    totalPoints >= SECURITY_CERTIFICATION_THRESHOLDS.basic.minPoints &&
    requiredRatio >= SECURITY_CERTIFICATION_THRESHOLDS.basic.requiredItemsRatio
  ) {
    return "basic";
  }

  return "none";
}

/**
 * Get progress statistics for the assessment
 */
export function getSecurityAssessmentStats(assessment: SecurityAssessmentData): {
  totalPoints: number;
  maxPoints: number;
  completedCount: number;
  totalCount: number;
  requiredCompleted: number;
  requiredTotal: number;
  requiredRatio: number;
  categoryProgress: Record<
    SecurityCategory,
    { completed: number; total: number; points: number; maxPoints: number }
  >;
} {
  const completedSet = new Set(assessment.completedItems);

  const maxPoints = SECURITY_CHECKLIST.reduce((sum, item) => sum + item.points, 0);
  const totalPoints = SECURITY_CHECKLIST.filter((item) => completedSet.has(item.id)).reduce(
    (sum, item) => sum + item.points,
    0,
  );

  const requiredItems = SECURITY_CHECKLIST.filter((item) => item.required);
  const completedRequired = requiredItems.filter((item) => completedSet.has(item.id));

  const categoryProgress: Record<
    SecurityCategory,
    { completed: number; total: number; points: number; maxPoints: number }
  > = {
    access_management: { completed: 0, total: 0, points: 0, maxPoints: 0 },
    physical_security: { completed: 0, total: 0, points: 0, maxPoints: 0 },
    employee_training: { completed: 0, total: 0, points: 0, maxPoints: 0 },
    incident_response: { completed: 0, total: 0, points: 0, maxPoints: 0 },
    privacy_practices: { completed: 0, total: 0, points: 0, maxPoints: 0 },
    vendor_management: { completed: 0, total: 0, points: 0, maxPoints: 0 },
  };

  for (const category of SECURITY_CATEGORY_KEYS) {
    const categoryItems = SECURITY_CHECKLIST.filter((item) => item.category === category);
    const completedCategoryItems = categoryItems.filter((item) => completedSet.has(item.id));

    categoryProgress[category] = {
      completed: completedCategoryItems.length,
      total: categoryItems.length,
      points: completedCategoryItems.reduce((sum, item) => sum + item.points, 0),
      maxPoints: categoryItems.reduce((sum, item) => sum + item.points, 0),
    };
  }

  return {
    totalPoints,
    maxPoints,
    completedCount: assessment.completedItems.length,
    totalCount: SECURITY_CHECKLIST.length,
    requiredCompleted: completedRequired.length,
    requiredTotal: requiredItems.length,
    requiredRatio: requiredItems.length > 0 ? completedRequired.length / requiredItems.length : 0,
    categoryProgress,
  };
}

/**
 * Get badge display info for a certification level
 */
export function getSecurityBadgeInfo(level: SecurityCertificationLevel): {
  label: string;
  description: string;
  gradient: string;
  tier: string;
} | null {
  switch (level) {
    case "basic":
      return {
        label: SECURITY_CERTIFICATION_THRESHOLDS.basic.label,
        description: SECURITY_CERTIFICATION_THRESHOLDS.basic.description,
        gradient: SECURITY_CERTIFICATION_THRESHOLDS.basic.badgeColor,
        tier: "Bronze",
      };
    case "standard":
      return {
        label: SECURITY_CERTIFICATION_THRESHOLDS.standard.label,
        description: SECURITY_CERTIFICATION_THRESHOLDS.standard.description,
        gradient: SECURITY_CERTIFICATION_THRESHOLDS.standard.badgeColor,
        tier: "Silver",
      };
    case "advanced":
      return {
        label: SECURITY_CERTIFICATION_THRESHOLDS.advanced.label,
        description: SECURITY_CERTIFICATION_THRESHOLDS.advanced.description,
        gradient: SECURITY_CERTIFICATION_THRESHOLDS.advanced.badgeColor,
        tier: "Gold",
      };
    case "excellence":
      return {
        label: SECURITY_CERTIFICATION_THRESHOLDS.excellence.label,
        description: SECURITY_CERTIFICATION_THRESHOLDS.excellence.description,
        gradient: SECURITY_CERTIFICATION_THRESHOLDS.excellence.badgeColor,
        tier: "Platinum",
      };
    default:
      return null;
  }
}

/**
 * Get quick wins - highest point items not yet completed
 */
export function getQuickWins(
  assessment: SecurityAssessmentData,
  limit: number = 5,
): SecurityChecklistItem[] {
  const completedSet = new Set(assessment.completedItems);

  return SECURITY_CHECKLIST.filter((item) => !completedSet.has(item.id))
    .sort((a, b) => b.points - a.points)
    .slice(0, limit);
}

/**
 * Get items with templates available
 */
export function getItemsWithTemplates(): SecurityChecklistItem[] {
  return SECURITY_CHECKLIST.filter((item) => item.templateId);
}

/**
 * External resources for security guidance
 */
export const SECURITY_RESOURCES = [
  {
    title: "NIST Cybersecurity Framework",
    url: "https://www.nist.gov/cyberframework",
    description: "Comprehensive security framework from the National Institute of Standards",
  },
  {
    title: "CIS Controls",
    url: "https://www.cisecurity.org/controls",
    description: "Prioritized security actions from the Center for Internet Security",
  },
  {
    title: "FTC Small Business Cybersecurity",
    url: "https://www.ftc.gov/business-guidance/small-businesses/cybersecurity",
    description: "Free resources from the Federal Trade Commission",
  },
  {
    title: "CISA Free Tools & Services",
    url: "https://www.cisa.gov/free-cybersecurity-services-and-tools",
    description: "Free security tools from the Cybersecurity & Infrastructure Security Agency",
  },
];

/**
 * Template metadata for downloadable templates
 */
export const SECURITY_TEMPLATES: Record<
  string,
  {
    title: string;
    description: string;
    filename: string;
  }
> = {
  "data-retention-policy": {
    title: "Data Retention Policy",
    description: "Template for defining how long data is kept and when it's deleted",
    filename: "data-retention-policy.md",
  },
  "password-policy": {
    title: "Password Policy",
    description: "Guidelines for strong passwords and credential management",
    filename: "password-policy.md",
  },
  "offboarding-checklist": {
    title: "Employee Offboarding Checklist",
    description: "Checklist for revoking access when employees leave",
    filename: "offboarding-checklist.md",
  },
  "onboarding-checklist": {
    title: "Employee Onboarding Checklist",
    description: "Security checklist for new employee setup",
    filename: "onboarding-checklist.md",
  },
  "incident-response-plan": {
    title: "Incident Response Plan",
    description: "Step-by-step guide for responding to security incidents",
    filename: "incident-response-plan.md",
  },
  "breach-notification-template": {
    title: "Breach Notification Template",
    description: "Template letters for notifying affected parties",
    filename: "breach-notification-template.md",
  },
  "security-training-checklist": {
    title: "Security Training Checklist",
    description: "Topics to cover in annual security awareness training",
    filename: "security-training-checklist.md",
  },
  "privacy-policy": {
    title: "Privacy Policy Template",
    description: "Customizable privacy policy for your website",
    filename: "privacy-policy.md",
  },
  "data-subject-request-form": {
    title: "Data Subject Request Form",
    description: "Form for customers to request access to their data",
    filename: "data-subject-request-form.md",
  },
  "vendor-security-questionnaire": {
    title: "Vendor Security Questionnaire",
    description: "Questions to assess vendor security practices",
    filename: "vendor-security-questionnaire.md",
  },
  "data-processing-agreement": {
    title: "Data Processing Agreement",
    description: "Contract template for vendors handling customer data",
    filename: "data-processing-agreement.md",
  },
};
