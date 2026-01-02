"use client";

import { ChevronDown } from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSectionProps {
  title?: string;
  subtitle?: string;
  faqs: FAQItem[];
  className?: string;
}

export function FAQSection({
  title = "Frequently Asked Questions",
  subtitle,
  faqs,
  className = "",
}: FAQSectionProps) {
  return (
    <section className={`py-20 ${className}`}>
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {title}
          </h2>
          {subtitle && (
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {subtitle}
            </p>
          )}
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <details
              key={index}
              className="group border border-border rounded-xl bg-card overflow-hidden"
            >
              <summary className="flex items-center justify-between cursor-pointer list-none px-6 py-5 hover:bg-muted transition-colors">
                <span className="font-semibold text-foreground text-left pr-4">
                  {faq.question}
                </span>
                <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0 transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-6 pb-5 pt-0 text-muted-foreground leading-relaxed border-t border-border">
                <div className="pt-4">{faq.answer}</div>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
