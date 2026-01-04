import { Metadata } from "next";
import { getStaticPageMetadata } from "@/lib/seo";
import { SoftwareJsonLd, FAQJsonLd } from "@/components/seo";
import DevelopersClient from "./DevelopersClient";

export const metadata: Metadata = getStaticPageMetadata("/developers");

const developerFaqs = [
  {
    question: "How do I get API access?",
    answer: "Sign in as staff and generate an API token in Settings > Developer. Use the token as a Bearer header in your requests.",
  },
  {
    question: "What endpoints are available?",
    answer: "The API provides endpoints for campgrounds, availability, reservations, guests, and payments. Check our OpenAPI spec for the complete list.",
  },
  {
    question: "Is the API free to use?",
    answer: "API access is included with all Keepr plans. Usage limits vary by plan tier.",
  },
  {
    question: "What authentication method does the API use?",
    answer: "The API uses token-based authentication with per-organization scoping. All requests require HTTPS.",
  },
];

export default function DevelopersPage() {
  return (
    <>
      <SoftwareJsonLd />
      <FAQJsonLd faqs={developerFaqs} />
      <DevelopersClient />
    </>
  );
}
