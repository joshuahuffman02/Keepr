import { Metadata } from "next";
import { Shield, Lock, Eye, Server, CheckCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Security - Keepr",
  description: "Learn about Keepr's security practices and how we protect your data.",
};

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-keepr-off-white">
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-keepr-evergreen to-keepr-evergreen-light rounded-2xl flex items-center justify-center shadow-lg">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Security at Keepr</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Your trust is our priority. We are building toward industry-standard security and will
            update this page as controls roll out.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-keepr-clay/10 text-keepr-clay text-sm border border-keepr-clay/20">
            This page describes planned and in-progress controls while we are in development.
          </div>
        </div>

        {/* Security Features */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="bg-card rounded-xl p-6 shadow-lg">
            <div className="w-12 h-12 bg-keepr-evergreen/10 rounded-lg flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-keepr-evergreen" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">Encryption</h3>
            <p className="text-muted-foreground text-sm">
              In transit: TLS (latest supported). At rest: modern cloud-managed encryption for
              storage and databases.
            </p>
          </div>

          <div className="bg-card rounded-xl p-6 shadow-lg">
            <div className="w-12 h-12 bg-keepr-charcoal/10 rounded-lg flex items-center justify-center mb-4">
              <Eye className="w-6 h-6 text-keepr-charcoal" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">Privacy by Design</h3>
            <p className="text-muted-foreground text-sm">
              We collect only the data necessary to provide our services and never sell your
              information.
            </p>
          </div>

          <div className="bg-card rounded-xl p-6 shadow-lg">
            <div className="w-12 h-12 bg-keepr-clay/10 rounded-lg flex items-center justify-center mb-4">
              <Server className="w-6 h-6 text-keepr-clay" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">Secure Infrastructure</h3>
            <p className="text-muted-foreground text-sm">
              Hosted on major cloud providers with managed networking, secrets, and monitoring.
              Formal SOC 2 attestation is planned post-GA.
            </p>
          </div>

          <div className="bg-card rounded-xl p-6 shadow-lg">
            <div className="w-12 h-12 bg-keepr-clay/10 rounded-lg flex items-center justify-center mb-4">
              <CheckCircle className="w-6 h-6 text-keepr-clay" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">Regular Audits</h3>
            <p className="text-muted-foreground text-sm">
              We conduct regular security audits and penetration testing to identify and address
              vulnerabilities.
            </p>
          </div>
        </div>

        {/* Detailed Practices */}
        <div className="bg-card rounded-2xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-2xl font-bold text-foreground mb-6">Our Security Practices</h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Payment Security</h3>
              <p className="text-muted-foreground">
                We partner with PCI-compliant processors and do not store full card numbers. Card
                data handling remains with the processor.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Access Controls</h3>
              <p className="text-muted-foreground">
                MFA for staff accounts is being rolled out. RBAC is enforced in-app; we run periodic
                access reviews for internal tools.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Data Backup & Recovery</h3>
              <p className="text-muted-foreground">
                We maintain scheduled backups with cloud-managed redundancy. DR playbooks are being
                exercised as part of GA readiness.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Incident Response</h3>
              <p className="text-muted-foreground">
                We maintain an incident response playbook and commit to timely notification of any
                confirmed breach. SLAs will be published at GA.
              </p>
            </div>
          </div>
        </div>

        {/* Report Security Issue */}
        <div className="bg-gradient-to-r from-keepr-charcoal to-slate-900 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Report a Security Issue</h2>
          <p className="text-white/70 mb-6 max-w-lg mx-auto">
            Found a security vulnerability? We appreciate responsible disclosure. Please report any
            security issues to our dedicated security team.
          </p>
          <a
            href="mailto:security@keeprstay.com"
            className="inline-flex items-center gap-2 px-6 py-3 bg-keepr-evergreen text-white font-semibold rounded-lg hover:bg-keepr-evergreen-light transition-colors"
          >
            <Shield className="w-5 h-5" />
            security@keeprstay.com
          </a>
        </div>
      </div>
    </div>
  );
}
