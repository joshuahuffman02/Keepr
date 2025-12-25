/**
 * Security & Privacy Certification System (CISO-level)
 * Based on NIST Cybersecurity Framework, CIS Controls, and privacy regulations (CCPA/GDPR)
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
  required: boolean; // Important items for certification
  points: number;
  templateId?: string; // Links to downloadable template
  resourceUrl?: string; // External resource link
}

export type SecurityCategory =
  | "data_protection"
  | "access_control"
  | "network_security"
  | "physical_security"
  | "incident_response"
  | "employee_training"
  | "privacy_compliance"
  | "vendor_management";

export const SECURITY_CATEGORIES: Record<SecurityCategory, { label: string; description: string }> = {
  data_protection: {
    label: "Data Protection",
    description: "Encryption, retention, and secure handling of customer data"
  },
  access_control: {
    label: "Access Control",
    description: "Authentication, authorization, and user account management"
  },
  network_security: {
    label: "Network Security",
    description: "Firewalls, WiFi security, and network monitoring"
  },
  physical_security: {
    label: "Physical Security",
    description: "Device security, office access, and physical safeguards"
  },
  incident_response: {
    label: "Incident Response",
    description: "Breach procedures, logging, and recovery planning"
  },
  employee_training: {
    label: "Employee Training",
    description: "Security awareness and ongoing education"
  },
  privacy_compliance: {
    label: "Privacy Compliance",
    description: "Privacy policies, consent, and data subject rights"
  },
  vendor_management: {
    label: "Vendor Management",
    description: "Third-party risk assessment and contracts"
  }
};

/**
 * Security Checklist Items
 * Comprehensive controls for campground operations
 */
export const SECURITY_CHECKLIST: SecurityChecklistItem[] = [
  // Data Protection (8 items, ~89 points)
  {
    id: "data_encrypt_rest",
    category: "data_protection",
    label: "Encrypt customer PII at rest",
    description: "Customer personal information is encrypted when stored in databases and backups",
    required: true,
    points: 15,
    resourceUrl: "https://www.nist.gov/publications/guide-storage-encryption-technologies-end-user-devices"
  },
  {
    id: "data_encrypt_transit",
    category: "data_protection",
    label: "Encrypt data in transit (HTTPS)",
    description: "All data transmission uses HTTPS/TLS encryption",
    required: true,
    points: 15,
    resourceUrl: "https://www.ftc.gov/business-guidance/resources/start-security-guide-business"
  },
  {
    id: "data_retention_policy",
    category: "data_protection",
    label: "Data retention policy defined",
    description: "Written policy specifying how long different types of data are kept and when deleted",
    required: true,
    points: 10,
    templateId: "data-retention-policy"
  },
  {
    id: "data_secure_deletion",
    category: "data_protection",
    label: "Secure deletion procedures",
    description: "Process for permanently destroying data when no longer needed",
    required: false,
    points: 8
  },
  {
    id: "data_classification",
    category: "data_protection",
    label: "Data classification system",
    description: "Data is categorized by sensitivity level (public, internal, confidential, restricted)",
    required: false,
    points: 8
  },
  {
    id: "data_backup_encryption",
    category: "data_protection",
    label: "Backup encryption enabled",
    description: "All backup data is encrypted before storage",
    required: true,
    points: 10
  },
  {
    id: "data_pci_compliance",
    category: "data_protection",
    label: "Credit card data PCI-compliant",
    description: "Payment card handling follows PCI-DSS requirements (or uses compliant processor)",
    required: true,
    points: 15,
    resourceUrl: "https://www.pcisecuritystandards.org/merchants/"
  },
  {
    id: "data_no_pii_logs",
    category: "data_protection",
    label: "No PII in logs or error messages",
    description: "Logs and error reports do not contain personal information",
    required: false,
    points: 8
  },

  // Access Control (8 items, ~75 points)
  {
    id: "access_unique_accounts",
    category: "access_control",
    label: "Unique user accounts (no shared logins)",
    description: "Each employee has their own login credentials",
    required: true,
    points: 10
  },
  {
    id: "access_password_policy",
    category: "access_control",
    label: "Strong password policy enforced",
    description: "Passwords require minimum length, complexity, and regular changes",
    required: true,
    points: 8,
    templateId: "password-policy"
  },
  {
    id: "access_mfa",
    category: "access_control",
    label: "Multi-factor authentication (MFA)",
    description: "MFA is required for all administrative and sensitive system access",
    required: true,
    points: 15,
    resourceUrl: "https://www.cisa.gov/mfa"
  },
  {
    id: "access_rbac",
    category: "access_control",
    label: "Role-based access control (RBAC)",
    description: "Users only have access to systems and data needed for their job",
    required: true,
    points: 10
  },
  {
    id: "access_reviews",
    category: "access_control",
    label: "Access reviews quarterly",
    description: "User access permissions are reviewed at least every 90 days",
    required: false,
    points: 8
  },
  {
    id: "access_offboarding",
    category: "access_control",
    label: "Immediate offboarding procedure",
    description: "Access is revoked same-day when employees leave",
    required: true,
    points: 10,
    templateId: "offboarding-checklist"
  },
  {
    id: "access_least_privilege",
    category: "access_control",
    label: "Least privilege principle applied",
    description: "Users start with minimal access and are granted more only as needed",
    required: false,
    points: 8
  },
  {
    id: "access_session_timeout",
    category: "access_control",
    label: "Session timeout configured",
    description: "Inactive sessions automatically log out after a set period",
    required: false,
    points: 6
  },

  // Network Security (6 items, ~60 points)
  {
    id: "network_firewall",
    category: "network_security",
    label: "Firewall configured and active",
    description: "Network firewall is in place and properly configured",
    required: true,
    points: 10,
    resourceUrl: "https://www.cisa.gov/news-events/news/understanding-firewalls-home-and-small-office-use"
  },
  {
    id: "network_guest_wifi",
    category: "network_security",
    label: "Guest WiFi separated from business",
    description: "Guest/public WiFi is on a separate network from business systems",
    required: true,
    points: 10
  },
  {
    id: "network_vpn",
    category: "network_security",
    label: "VPN for remote access",
    description: "Remote workers use VPN to connect to business systems",
    required: false,
    points: 10
  },
  {
    id: "network_vulnerability_scanning",
    category: "network_security",
    label: "Regular vulnerability scanning",
    description: "Systems are scanned for vulnerabilities at least quarterly",
    required: false,
    points: 12
  },
  {
    id: "network_segmentation",
    category: "network_security",
    label: "Network segmentation",
    description: "Critical systems are on separate network segments",
    required: false,
    points: 8
  },
  {
    id: "network_ids",
    category: "network_security",
    label: "Intrusion detection/monitoring",
    description: "Network traffic is monitored for suspicious activity",
    required: false,
    points: 10
  },

  // Physical Security (6 items, ~41 points)
  {
    id: "physical_device_storage",
    category: "physical_security",
    label: "Secure storage for devices",
    description: "Laptops and devices are stored securely when not in use",
    required: true,
    points: 8
  },
  {
    id: "physical_screen_lock",
    category: "physical_security",
    label: "Screen lock policy",
    description: "Devices automatically lock after brief inactivity",
    required: true,
    points: 6
  },
  {
    id: "physical_visitor_access",
    category: "physical_security",
    label: "Visitor access controls",
    description: "Visitors are logged and escorted in sensitive areas",
    required: false,
    points: 6
  },
  {
    id: "physical_surveillance",
    category: "physical_security",
    label: "Surveillance in sensitive areas",
    description: "Security cameras monitor areas with sensitive equipment",
    required: false,
    points: 8
  },
  {
    id: "physical_clean_desk",
    category: "physical_security",
    label: "Clean desk policy",
    description: "Sensitive documents are not left visible on desks",
    required: false,
    points: 5
  },
  {
    id: "physical_document_disposal",
    category: "physical_security",
    label: "Secure document disposal",
    description: "Paper documents with sensitive info are shredded",
    required: true,
    points: 8
  },

  // Incident Response (7 items, ~68 points)
  {
    id: "incident_plan",
    category: "incident_response",
    label: "Incident response plan documented",
    description: "Written plan for responding to security incidents",
    required: true,
    points: 12,
    templateId: "incident-response-plan"
  },
  {
    id: "incident_contact",
    category: "incident_response",
    label: "Security contact designated",
    description: "Specific person responsible for security incidents",
    required: true,
    points: 8
  },
  {
    id: "incident_breach_notification",
    category: "incident_response",
    label: "Breach notification procedures",
    description: "Process for notifying affected parties and regulators",
    required: true,
    points: 10,
    templateId: "breach-notification-template"
  },
  {
    id: "incident_logging",
    category: "incident_response",
    label: "Security event logging enabled",
    description: "System and access logs are captured and stored",
    required: true,
    points: 10
  },
  {
    id: "incident_log_retention",
    category: "incident_response",
    label: "Log retention (90+ days)",
    description: "Security logs are kept for at least 90 days",
    required: false,
    points: 8
  },
  {
    id: "incident_backup_tested",
    category: "incident_response",
    label: "Backup & recovery tested",
    description: "Data restoration is tested at least annually",
    required: true,
    points: 12
  },
  {
    id: "incident_post_review",
    category: "incident_response",
    label: "Post-incident review process",
    description: "Formal review conducted after security incidents",
    required: false,
    points: 8
  },

  // Employee Training (5 items, ~44 points)
  {
    id: "training_awareness",
    category: "employee_training",
    label: "Security awareness training (annual)",
    description: "All employees complete security training yearly",
    required: true,
    points: 12,
    templateId: "security-training-checklist",
    resourceUrl: "https://www.cisa.gov/free-cybersecurity-services-and-tools"
  },
  {
    id: "training_phishing",
    category: "employee_training",
    label: "Phishing awareness training",
    description: "Employees trained to recognize and report phishing attempts",
    required: true,
    points: 10,
    resourceUrl: "https://www.ftc.gov/business-guidance/small-businesses/cybersecurity/phishing"
  },
  {
    id: "training_onboarding",
    category: "employee_training",
    label: "New hire security onboarding",
    description: "Security policies covered during employee onboarding",
    required: true,
    points: 8
  },
  {
    id: "training_password",
    category: "employee_training",
    label: "Secure password training",
    description: "Employees trained on password best practices",
    required: false,
    points: 6
  },
  {
    id: "training_social_engineering",
    category: "employee_training",
    label: "Social engineering awareness",
    description: "Training on recognizing manipulation attempts",
    required: false,
    points: 8
  },

  // Privacy Compliance (7 items, ~60 points)
  {
    id: "privacy_policy",
    category: "privacy_compliance",
    label: "Privacy policy published",
    description: "Clear privacy policy available on website",
    required: true,
    points: 10,
    templateId: "privacy-policy"
  },
  {
    id: "privacy_consent",
    category: "privacy_compliance",
    label: "Consent collection documented",
    description: "Records of when and how consent was obtained",
    required: true,
    points: 8
  },
  {
    id: "privacy_dsar",
    category: "privacy_compliance",
    label: "Data subject access request process",
    description: "Process for handling requests to access personal data",
    required: true,
    points: 10,
    templateId: "data-subject-request-form"
  },
  {
    id: "privacy_deletion",
    category: "privacy_compliance",
    label: "Right to deletion honored",
    description: "Process for deleting personal data on request",
    required: true,
    points: 10
  },
  {
    id: "privacy_cookies",
    category: "privacy_compliance",
    label: "Cookie/tracking disclosure",
    description: "Clear disclosure of cookies and tracking technologies",
    required: false,
    points: 8
  },
  {
    id: "privacy_optout",
    category: "privacy_compliance",
    label: "Marketing opt-out available",
    description: "Easy way for customers to unsubscribe from marketing",
    required: false,
    points: 6
  },
  {
    id: "privacy_third_party",
    category: "privacy_compliance",
    label: "Third-party data sharing disclosed",
    description: "Customers informed about data shared with partners",
    required: false,
    points: 8
  },

  // Vendor Management (5 items, ~40 points)
  {
    id: "vendor_requirements",
    category: "vendor_management",
    label: "Vendor security requirements",
    description: "Security standards required of vendors in contracts",
    required: true,
    points: 8,
    templateId: "vendor-security-questionnaire"
  },
  {
    id: "vendor_dpa",
    category: "vendor_management",
    label: "Data processing agreements",
    description: "Signed DPAs with vendors handling customer data",
    required: true,
    points: 10,
    templateId: "data-processing-agreement"
  },
  {
    id: "vendor_inventory",
    category: "vendor_management",
    label: "Vendor inventory maintained",
    description: "List of all vendors with access to systems or data",
    required: false,
    points: 6
  },
  {
    id: "vendor_backup_plans",
    category: "vendor_management",
    label: "Critical vendor backup plans",
    description: "Contingency plans if key vendors become unavailable",
    required: false,
    points: 8
  },
  {
    id: "vendor_reviews",
    category: "vendor_management",
    label: "Annual vendor reviews",
    description: "Vendor security is reviewed at least yearly",
    required: false,
    points: 8
  }
];

/**
 * Certification level thresholds
 */
export const SECURITY_CERTIFICATION_THRESHOLDS = {
  basic: {
    minPoints: 40,
    requiredItemsRatio: 0.3, // 30% of required items
    label: "Basic Security",
    description: "Foundational security hygiene is in place",
    badgeColor: "from-amber-600 to-amber-700" // Bronze
  },
  standard: {
    minPoints: 100,
    requiredItemsRatio: 0.6, // 60% of required items
    label: "Standard Security",
    description: "Industry best practices are followed",
    badgeColor: "from-slate-400 to-slate-500" // Silver
  },
  advanced: {
    minPoints: 180,
    requiredItemsRatio: 0.85, // 85% of required items
    label: "Advanced Security",
    description: "CISO-grade security controls implemented",
    badgeColor: "from-yellow-400 to-amber-500" // Gold
  },
  excellence: {
    minPoints: 280,
    requiredItemsRatio: 1.0, // 100% of required items
    label: "Security Excellence",
    description: "Enterprise-level security and privacy protection",
    badgeColor: "from-cyan-400 to-blue-500" // Platinum
  }
};

export interface SecurityAssessmentData {
  completedItems: string[]; // Array of checklist item IDs
  notes?: string;
  lastUpdated?: string;
}

export interface SecurityAuditorInfo {
  verified: boolean;
  verifiedAt?: string;
  verifiedBy?: string; // Auditor name
  auditorEmail?: string;
  auditorOrg?: string;
}

/**
 * Calculate certification level based on assessment data
 */
export function calculateSecurityCertificationLevel(assessment: SecurityAssessmentData): SecurityCertificationLevel {
  const completedSet = new Set(assessment.completedItems);

  // Calculate points
  const totalPoints = SECURITY_CHECKLIST
    .filter(item => completedSet.has(item.id))
    .reduce((sum, item) => sum + item.points, 0);

  // Calculate required items completion ratio
  const requiredItems = SECURITY_CHECKLIST.filter(item => item.required);
  const completedRequired = requiredItems.filter(item => completedSet.has(item.id));
  const requiredRatio = requiredItems.length > 0
    ? completedRequired.length / requiredItems.length
    : 0;

  // Determine level (check from highest to lowest)
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
  categoryProgress: Record<SecurityCategory, { completed: number; total: number; points: number; maxPoints: number }>;
} {
  const completedSet = new Set(assessment.completedItems);

  const maxPoints = SECURITY_CHECKLIST.reduce((sum, item) => sum + item.points, 0);
  const totalPoints = SECURITY_CHECKLIST
    .filter(item => completedSet.has(item.id))
    .reduce((sum, item) => sum + item.points, 0);

  const requiredItems = SECURITY_CHECKLIST.filter(item => item.required);
  const completedRequired = requiredItems.filter(item => completedSet.has(item.id));

  // Calculate per-category progress
  const categoryProgress = {} as Record<SecurityCategory, { completed: number; total: number; points: number; maxPoints: number }>;

  for (const category of Object.keys(SECURITY_CATEGORIES) as SecurityCategory[]) {
    const categoryItems = SECURITY_CHECKLIST.filter(item => item.category === category);
    const completedCategoryItems = categoryItems.filter(item => completedSet.has(item.id));

    categoryProgress[category] = {
      completed: completedCategoryItems.length,
      total: categoryItems.length,
      points: completedCategoryItems.reduce((sum, item) => sum + item.points, 0),
      maxPoints: categoryItems.reduce((sum, item) => sum + item.points, 0)
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
    categoryProgress
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
        tier: "Bronze"
      };
    case "standard":
      return {
        label: SECURITY_CERTIFICATION_THRESHOLDS.standard.label,
        description: SECURITY_CERTIFICATION_THRESHOLDS.standard.description,
        gradient: SECURITY_CERTIFICATION_THRESHOLDS.standard.badgeColor,
        tier: "Silver"
      };
    case "advanced":
      return {
        label: SECURITY_CERTIFICATION_THRESHOLDS.advanced.label,
        description: SECURITY_CERTIFICATION_THRESHOLDS.advanced.description,
        gradient: SECURITY_CERTIFICATION_THRESHOLDS.advanced.badgeColor,
        tier: "Gold"
      };
    case "excellence":
      return {
        label: SECURITY_CERTIFICATION_THRESHOLDS.excellence.label,
        description: SECURITY_CERTIFICATION_THRESHOLDS.excellence.description,
        gradient: SECURITY_CERTIFICATION_THRESHOLDS.excellence.badgeColor,
        tier: "Platinum"
      };
    default:
      return null;
  }
}

/**
 * Get quick wins - highest point items not yet completed
 */
export function getQuickWins(assessment: SecurityAssessmentData, limit: number = 5): SecurityChecklistItem[] {
  const completedSet = new Set(assessment.completedItems);

  return SECURITY_CHECKLIST
    .filter(item => !completedSet.has(item.id))
    .sort((a, b) => b.points - a.points)
    .slice(0, limit);
}

/**
 * Get items with templates available
 */
export function getItemsWithTemplates(): SecurityChecklistItem[] {
  return SECURITY_CHECKLIST.filter(item => item.templateId);
}

/**
 * External resources for security guidance
 */
export const SECURITY_RESOURCES = [
  {
    title: "NIST Cybersecurity Framework",
    url: "https://www.nist.gov/cyberframework",
    description: "Comprehensive security framework from the National Institute of Standards"
  },
  {
    title: "CIS Controls",
    url: "https://www.cisecurity.org/controls",
    description: "Prioritized security actions from the Center for Internet Security"
  },
  {
    title: "FTC Small Business Cybersecurity",
    url: "https://www.ftc.gov/business-guidance/small-businesses/cybersecurity",
    description: "Free resources from the Federal Trade Commission"
  },
  {
    title: "CISA Free Tools & Services",
    url: "https://www.cisa.gov/free-cybersecurity-services-and-tools",
    description: "Free security tools from the Cybersecurity & Infrastructure Security Agency"
  },
  {
    title: "PCI Security Standards",
    url: "https://www.pcisecuritystandards.org/merchants/",
    description: "Payment card industry security requirements"
  },
  {
    title: "California Consumer Privacy Act (CCPA)",
    url: "https://oag.ca.gov/privacy/ccpa",
    description: "California privacy law requirements"
  }
];

/**
 * Template metadata for downloadable templates
 */
export const SECURITY_TEMPLATES: Record<string, {
  title: string;
  description: string;
  filename: string;
}> = {
  "data-retention-policy": {
    title: "Data Retention Policy",
    description: "Template for defining how long data is kept and when it's deleted",
    filename: "data-retention-policy.md"
  },
  "password-policy": {
    title: "Password Policy",
    description: "Guidelines for strong passwords and credential management",
    filename: "password-policy.md"
  },
  "offboarding-checklist": {
    title: "Employee Offboarding Checklist",
    description: "Checklist for revoking access when employees leave",
    filename: "offboarding-checklist.md"
  },
  "incident-response-plan": {
    title: "Incident Response Plan",
    description: "Step-by-step guide for responding to security incidents",
    filename: "incident-response-plan.md"
  },
  "breach-notification-template": {
    title: "Breach Notification Template",
    description: "Template letters for notifying affected parties",
    filename: "breach-notification-template.md"
  },
  "security-training-checklist": {
    title: "Security Training Checklist",
    description: "Topics to cover in annual security awareness training",
    filename: "security-training-checklist.md"
  },
  "privacy-policy": {
    title: "Privacy Policy Template",
    description: "Customizable privacy policy for your website",
    filename: "privacy-policy.md"
  },
  "data-subject-request-form": {
    title: "Data Subject Request Form",
    description: "Form for customers to request access to their data",
    filename: "data-subject-request-form.md"
  },
  "vendor-security-questionnaire": {
    title: "Vendor Security Questionnaire",
    description: "Questions to assess vendor security practices",
    filename: "vendor-security-questionnaire.md"
  },
  "data-processing-agreement": {
    title: "Data Processing Agreement",
    description: "Contract template for vendors handling customer data",
    filename: "data-processing-agreement.md"
  }
};
