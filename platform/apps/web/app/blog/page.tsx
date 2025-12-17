import { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ArrowRight, Tent, Map, Caravan, Users, Wrench, TreePine } from "lucide-react";
import { PublicHeader } from "../../components/public/PublicHeader";
import { getAllPosts, getCategories } from "../../lib/blog";

export const metadata: Metadata = {
  title: "Blog - Camp Everyday",
  description: "Camping tips, destination guides, and industry insights from Camp Everyday.",
};

// Map categories to icons/labels
const categoryConfig: Record<string, { label: string; icon: any }> = {
  "camper-tips": { label: "Camper Tips", icon: Tent },
  "growth": { label: "Growth Strategies", icon: TreePine },
  "industry": { label: "Industry Trends", icon: Map },
  "operations": { label: "Campground Operations", icon: Wrench },
  "technology": { label: "Technology", icon: Caravan },
};

export default function BlogPage() {
  const posts = getAllPosts();
  const categories = getCategories();

  // Group latest posts by category (or just show latest mixed)
  // Let's show all categories

  return (
    <div className="min-h-screen bg-slate-50">
      <PublicHeader />
      <div className="max-w-7xl mx-auto px-6 py-16 pt-24">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            Camp Everyday Blog
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Tips, guides, and stories from the camping community.
          </p>
        </div>

        {/* Categories Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {categories.map(category => {
            const catPosts = posts.filter(p => p.category === category);
            const config = categoryConfig[category] || { label: category, icon: BookOpen };
            const Icon = config.icon;

            if (catPosts.length === 0) return null;

            return (
              <div key={category} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-emerald-50 rounded-lg">
                    <Icon className="w-6 h-6 text-emerald-600" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">{config.label}</h2>
                </div>
                <ul className="space-y-4">
                  {catPosts.map(post => (
                    <li key={post.slug}>
                      <Link
                        href={`/blog/${category}/${post.slug}`}
                        className="group block"
                      >
                        <h3 className="font-medium text-slate-900 group-hover:text-emerald-600 transition-colors line-clamp-2">
                          {post.title}
                        </h3>
                        {post.description && (
                          <p className="text-sm text-slate-500 line-clamp-2 mt-1">
                            {post.description}
                          </p>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="text-center bg-slate-900 rounded-3xl p-12 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/20 via-transparent to-transparent opacity-50" />
          <div className="relative z-10">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Ready to grow your campground?
            </h2>
            <p className="text-slate-300 mb-8 max-w-2xl mx-auto">
              Get the tools you need to manage reservations, marketing, and operations—all in one place.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white font-semibold rounded-lg hover:bg-emerald-400 transition-colors"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 text-white mt-20">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m4 20 8-14 8 14" />
                    <path d="M2 20h20" />
                  </svg>
                </div>
                <span className="text-xl font-bold">Camp Everyday</span>
              </div>
              <p className="text-slate-400 text-sm">
                Discover and book the perfect campground for your next adventure.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-sm uppercase tracking-wider text-slate-400 mb-4">Explore</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/" className="text-slate-300 hover:text-white transition-colors">Find Campgrounds</a></li>
                <li><a href="/" className="text-slate-300 hover:text-white transition-colors">Top Destinations</a></li>
                <li><a href="/" className="text-slate-300 hover:text-white transition-colors">RV Parks</a></li>
                <li><a href="/blog" className="text-slate-300 hover:text-white transition-colors">Blog</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-sm uppercase tracking-wider text-slate-400 mb-4">For Owners</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/auth/signin?callbackUrl=/dashboard" className="text-slate-300 hover:text-white transition-colors">Owner Login</a></li>
                <li><a href="/owners" className="text-slate-300 hover:text-white transition-colors">List Your Property</a></li>
                <li><a href="/owners" className="text-slate-300 hover:text-white transition-colors">Management Tools</a></li>
                <li><a href="/owners#pricing" className="text-slate-300 hover:text-white transition-colors">Pricing</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-sm uppercase tracking-wider text-slate-400 mb-4">Support</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/help" className="text-slate-300 hover:text-white transition-colors">Help Center</a></li>
                <li><a href="/contact" className="text-slate-300 hover:text-white transition-colors">Contact Us</a></li>
                <li><a href="/terms" className="text-slate-300 hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="/privacy" className="text-slate-300 hover:text-white transition-colors">Privacy Policy</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} Camp Everyday. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
