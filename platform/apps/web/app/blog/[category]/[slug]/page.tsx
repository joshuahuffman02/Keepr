import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { PublicHeader } from "../../../../components/public/PublicHeader";
import { getPostBySlug } from "../../../../lib/blog";
import { ArrowLeft, Calendar, Clock, Share2, Tag, User } from "lucide-react";

interface Props {
  params: {
    category: string;
    slug: string;
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = getPostBySlug(params.category, params.slug);

  if (!post) {
    return {
      title: "Post Not Found",
    };
  }

  return {
    title: `${post.title} - Keepr Blog`,
    description: post.description,
  };
}

export default function BlogPostPage({ params }: Props) {
  const post = getPostBySlug(params.category, params.slug);

  if (!post) {
    notFound();
  }

  // Calculate read time (rough estimate: 200 words per minute)
  const wordCount = post.content.split(/\s+/g).length;
  const readTime = Math.ceil(wordCount / 200);

  // Clean content - Remove H1 and Meta content that we parsed already
  const cleanContent = post.content
    .replace(/^#\s+(.+)$/m, "") // Remove H1
    .replace(/\*\*Meta Description:\*\*.+$/m, "") // Remove Meta Description
    .replace(/\*\*Target Keywords:\*\*.+$/m, "")
    .replace(/\*\*Word Count:\*\*.+$/m, "")
    .trim();

  const formattedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-white font-sans">
      <PublicHeader />

      {/* Hero Section */}
      <div className="relative bg-slate-900 text-white py-24 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 to-slate-900" />
        <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay" />

        <div className="relative max-w-4xl mx-auto px-6">
          <Link
            href="/blog"
            className="inline-flex items-center text-sm text-emerald-300 hover:text-white mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Blog
          </Link>

          <div className="flex flex-wrap items-center gap-4 text-sm font-medium mb-6">
            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/30 capitalize">
              {post.category.replace(/-/g, " ")}
            </span>
            <span className="flex items-center gap-1 text-slate-300">
              <Clock className="w-4 h-4" />
              {readTime} min read
            </span>
            <span className="flex items-center gap-1 text-slate-300">
              <Calendar className="w-4 h-4" />
              {formattedDate}
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            {post.title}
          </h1>

          {post.description && (
            <p className="text-xl text-slate-300 leading-relaxed max-w-3xl">{post.description}</p>
          )}

          <div className="flex items-center gap-4 mt-8 pt-8 border-t border-white/10">
            <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center font-bold text-white">
              CE
            </div>
            <div>
              <div className="font-semibold text-white">Keepr Team</div>
              <div className="text-sm text-slate-400">Curated Guides & Tips</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Main Content */}
          <div className="lg:col-span-8">
            <article
              className="prose prose-lg prose-slate max-w-none 
                    prose-headings:font-bold prose-headings:text-slate-900 
                    prose-p:text-slate-700 prose-p:leading-relaxed
                    prose-a:text-emerald-600 hover:prose-a:text-emerald-500 prose-a:no-underline hover:prose-a:underline
                    prose-strong:text-slate-900 prose-strong:font-bold
                    prose-ul:list-disc prose-ul:pl-6 prose-li:marker:text-emerald-500
                    prose-img:rounded-2xl prose-img:shadow-lg
                    prose-blockquote:border-emerald-500 prose-blockquote:bg-emerald-50/50 prose-blockquote:p-4 prose-blockquote:rounded-r-lg prose-blockquote:not-italic
                "
            >
              <ReactMarkdown
                components={{
                  a: ({ node, ...props }) => {
                    return (
                      <a
                        {...props}
                        className="text-emerald-600 hover:text-emerald-500 font-medium transition-colors"
                      />
                    );
                  },
                }}
              >
                {cleanContent}
              </ReactMarkdown>
            </article>

            {/* Newsletter CTA */}
            <div className="mt-16 bg-slate-50 rounded-2xl p-8 md:p-12 border border-slate-100">
              <div className="text-center">
                <h3 className="text-2xl font-bold text-slate-900 mb-4">Subscribe to Keepr</h3>
                <p className="text-slate-600 mb-8">
                  Get the latest camping tips and industry insights delivered straight to your
                  inbox.
                </p>
                <form className="flex gap-2 max-w-md mx-auto">
                  <input
                    type="email"
                    placeholder="hello@keeprstay.com"
                    className="flex-1 px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  />
                  <button
                    type="submit"
                    className="px-6 py-3 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    Subscribe
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 sticky top-24">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Share2 className="w-4 h-4" />
                Share this article
              </h3>
              <div className="flex gap-2">
                <button className="flex-1 py-2 px-4 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors text-slate-700">
                  X
                </button>
                <button className="flex-1 py-2 px-4 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors text-slate-700">
                  Facebook
                </button>
                <button className="flex-1 py-2 px-4 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors text-slate-700">
                  LinkedIn
                </button>
              </div>

              <div className="mt-8 pt-8 border-t border-slate-200">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  Related Topics
                </h3>
                <div className="flex flex-wrap gap-2">
                  {["Camping", "Outdoors", "Travel", "Guides"].map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m4 20 8-14 8 14" />
                    <path d="M2 20h20" />
                  </svg>
                </div>
                <span className="text-xl font-bold">Keepr</span>
              </div>
              <p className="text-slate-400 text-sm">
                Discover and book the perfect campground for your next adventure.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-sm uppercase tracking-wider text-slate-400 mb-4">
                Explore
              </h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="/" className="text-slate-300 hover:text-white transition-colors">
                    Find Campgrounds
                  </a>
                </li>
                <li>
                  <a href="/" className="text-slate-300 hover:text-white transition-colors">
                    Top Destinations
                  </a>
                </li>
                <li>
                  <a href="/" className="text-slate-300 hover:text-white transition-colors">
                    RV Parks
                  </a>
                </li>
                <li>
                  <a href="/blog" className="text-slate-300 hover:text-white transition-colors">
                    Blog
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-sm uppercase tracking-wider text-slate-400 mb-4">
                For Owners
              </h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="/auth/signin?callbackUrl=/dashboard"
                    className="text-slate-300 hover:text-white transition-colors"
                  >
                    Owner Login
                  </a>
                </li>
                <li>
                  <a href="/owners" className="text-slate-300 hover:text-white transition-colors">
                    List Your Property
                  </a>
                </li>
                <li>
                  <a href="/owners" className="text-slate-300 hover:text-white transition-colors">
                    Management Tools
                  </a>
                </li>
                <li>
                  <a
                    href="/owners#pricing"
                    className="text-slate-300 hover:text-white transition-colors"
                  >
                    Pricing
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-sm uppercase tracking-wider text-slate-400 mb-4">
                Support
              </h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="/help" className="text-slate-300 hover:text-white transition-colors">
                    Help Center
                  </a>
                </li>
                <li>
                  <a href="/contact" className="text-slate-300 hover:text-white transition-colors">
                    Contact Us
                  </a>
                </li>
                <li>
                  <a href="/terms" className="text-slate-300 hover:text-white transition-colors">
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a href="/privacy" className="text-slate-300 hover:text-white transition-colors">
                    Privacy Policy
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} Keepr. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
