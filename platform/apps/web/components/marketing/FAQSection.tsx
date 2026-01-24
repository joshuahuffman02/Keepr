"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";

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

function FAQCard({
  faq,
  index,
  isOpen,
  onToggle,
}: {
  faq: FAQItem;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const prefersReducedMotion = useReducedMotionSafe();
  const answerId = `faq-answer-${index}`;
  const buttonId = `faq-button-${index}`;

  return (
    <motion.div
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={
        prefersReducedMotion ? {} : { duration: 0.4, delay: index * 0.05, ease: "easeOut" }
      }
      className={cn(
        "border rounded-2xl bg-card overflow-hidden transition-all duration-300",
        isOpen
          ? "border-keepr-evergreen/40 shadow-lg shadow-keepr-evergreen/5"
          : "border-border hover:border-keepr-evergreen/20 hover:shadow-md",
      )}
    >
      <button
        onClick={onToggle}
        id={buttonId}
        type="button"
        className="w-full flex items-center justify-between cursor-pointer px-6 py-5 hover:bg-muted/50 transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-keepr-evergreen focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        aria-expanded={isOpen}
        aria-controls={answerId}
      >
        <span
          className={cn(
            "font-semibold text-left pr-4 transition-colors duration-300",
            isOpen ? "text-keepr-evergreen" : "text-foreground",
          )}
        >
          {faq.question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className={cn(
            "flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center transition-colors duration-300",
            isOpen ? "bg-keepr-evergreen/10" : "bg-muted",
          )}
        >
          <ChevronDown
            className={cn(
              "h-5 w-5 transition-colors duration-300",
              isOpen ? "text-keepr-evergreen" : "text-muted-foreground",
            )}
          />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={prefersReducedMotion ? {} : { height: 0, opacity: 0 }}
            animate={prefersReducedMotion ? {} : { height: "auto", opacity: 1 }}
            exit={prefersReducedMotion ? {} : { height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
            id={answerId}
            role="region"
            aria-labelledby={buttonId}
          >
            <div className="px-6 pb-6 pt-0">
              <div className="border-t border-border pt-4 text-muted-foreground leading-relaxed">
                {faq.answer}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function FAQSection({
  title = "Frequently Asked Questions",
  subtitle,
  faqs,
  className = "",
}: FAQSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });
  const prefersReducedMotion = useReducedMotionSafe();

  const handleToggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  // Split FAQs into two columns for desktop
  const midpoint = Math.ceil(faqs.length / 2);
  const leftColumn = faqs.slice(0, midpoint);
  const rightColumn = faqs.slice(midpoint);

  return (
    <section ref={sectionRef} className={cn("py-20", className)}>
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto mb-12"
        >
          <p className="text-sm font-medium text-keepr-evergreen uppercase tracking-wider mb-3">
            Got Questions?
          </p>
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">{title}</h2>
          {subtitle && <p className="text-lg text-muted-foreground">{subtitle}</p>}
        </motion.div>

        {/* 2-Column FAQ Grid on Desktop, Single Column on Mobile */}
        <div className="grid lg:grid-cols-2 gap-4 lg:gap-6">
          {/* Left Column */}
          <div className="space-y-4">
            {leftColumn.map((faq, index) => (
              <FAQCard
                key={index}
                faq={faq}
                index={index}
                isOpen={openIndex === index}
                onToggle={() => handleToggle(index)}
              />
            ))}
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            {rightColumn.map((faq, index) => {
              const actualIndex = index + midpoint;
              return (
                <FAQCard
                  key={actualIndex}
                  faq={faq}
                  index={actualIndex}
                  isOpen={openIndex === actualIndex}
                  onToggle={() => handleToggle(actualIndex)}
                />
              );
            })}
          </div>
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-center mt-12 pt-8 border-t border-border"
        >
          <p className="text-muted-foreground mb-2">Still have questions?</p>
          <a
            href="mailto:hello@keeprstay.com"
            className="inline-flex items-center gap-2 text-keepr-evergreen font-semibold hover:underline"
          >
            Reach out to our team
            <span aria-hidden="true">&rarr;</span>
          </a>
        </motion.div>
      </div>
    </section>
  );
}
