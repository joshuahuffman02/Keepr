import { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ArrowRight, Tent, Map, Caravan, Users, Wrench, TreePine, Calendar, Clock, ChevronRight } from "lucide-react";
import { PublicHeader } from "../../components/public/PublicHeader";
import { getAllPosts, getCategories, getDebugInfo } from "../../lib/blog";

export const metadata: Metadata = {
  title: "Blog - Camp Everyday",
  description: "Camping tips, destination guides, and industry insights from Camp Everyday.",
};

// Map categories to icons/labels
const categoryConfig: Record<string, { label: string; icon: any; color: string }> = {
  "camper-tips": { label: "Camper Tips", icon: Tent, color: "text-emerald-500" },
  "growth": { label: "Growth Strategies", icon: TreePine, color: "text-amber-500" },
  "industry": { label: "Industry Trends", icon: Map, color: "text-violet-500" },
  "operations": { label: "Campground Operations", icon: Wrench, color: "text-blue-500" },
  "technology": { label: "Technology", icon: Caravan, color: "text-cyan-500" },
};

export default function BlogPage() {
  const posts = getAllPosts();
  const categories = getCategories();

  if (posts.length === 0) {
    const debug = getDebugInfo();
    return (
      <div className="min-h-screen bg-slate-900 text-green-400 p-8 font-mono overflow-auto">
        <h1 className="text-xl font-bold mb-4">Blog Debug Info</h1>
        <div className="bg-slate-800 p-4 rounded mb-4">
          <p><strong>CWD:</strong> {debug.cwd}</p>
          <p><strong>Resolved Blog Dir:</strong> {String(debug.blogDir)}</p>
        </div>
      </div>
    );
  }
  // Sort posts by something if we had dates, for now just reverse so newest (bottom of file list?) is first
  // Actually file system order is arbitrary. Let's assume the order getAllPosts returns is acceptable or we could simple reverse.
  const sortedPosts = [...posts]; // .reverse() if needed

  const featuredPost = sortedPosts[0];
  const remainingPosts = sortedPosts.slice(1);

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <PublicHeader />

      {/* Hero Section */}
      <div className="relative bg-slate-900 text-white py-24 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 to-slate-900" />
        <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay" />

        <div className="relative max-w-7xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-full border border-emerald-500/20 mb-8 backdrop-blur-sm">
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium text-emerald-300">The Camp Everyday Blog</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Insights for the <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
              Modern Campground
            </span>
          </h1>

          <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            Expert tips on campground management, growth strategies, and the latest industry trends.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            {categories.map(cat => (
              <a href={`#${cat}`} key={cat} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm font-medium transition-colors">
                {categoryConfig[cat]?.label || cat}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-16 -mt-20 relative z-10">

        {/* Featured Post Card */}
        {featuredPost && (
          <div className="bg-white rounded-3xl p-8 md:p-12 shadow-xl shadow-slate-900/5 border border-slate-100 mb-20 group cursor-pointer hover:shadow-2xl transition-all relative overflow-hidden">
            <Link href={`/blog/${featuredPost.category}/${featuredPost.slug}`} className="absolute inset-0 z-10" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-bl-[100px] -mr-16 -mt-16 opacity-50 group-hover:scale-110 transition-transform duration-500" />

            <div className="relative z-0">
              <div className="flex items-center gap-4 mb-6">
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-100 ${categoryConfig[featuredPost.category]?.color || 'text-slate-600'}`}>
                  {categoryConfig[featuredPost.category]?.label || featuredPost.category}
                </span>
                <span className="text-slate-400 text-sm flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {Math.ceil(featuredPost.content.split(/\s+/).length / 200)} min read
                </span>
              </div>

              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4 group-hover:text-emerald-600 transition-colors">
                {featuredPost.title}
              </h2>

              <p className="text-xl text-slate-600 mb-8 max-w-3xl line-clamp-3 leading-relaxed">
                {featuredPost.description}
              </p>

              <span className="inline-flex items-center gap-2 text-emerald-600 font-semibold group-hover:gap-3 transition-all">
                Read Story <ArrowRight className="w-5 h-5" />
              </span>
            </div>
          </div>
        )}

        {/* Categories Sections */}
        {categories.map(category => {
          const catPosts = posts.filter(p => p.category === category);
          const config = categoryConfig[category] || { label: category, icon: BookOpen, color: 'text-slate-600' };
          const Icon = config.icon;

          if (catPosts.length === 0) return null;

          return (
            <div key={category} id={category} className="mb-20 scroll-mt-32">
              <div className="flex items-center gap-4 mb-10">
                <div className={`p-3 rounded-2xl bg-white shadow-sm border border-slate-100 ${config.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900">{config.label}</h2>
                <div className="h-px flex-1 bg-slate-200 ml-4" />
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {catPosts.map(post => (
                  <Link
                    key={post.slug}
                    href={`/blog/${category}/${post.slug}`}
                    className="group bg-white rounded-2xl overflow-hidden border border-slate-100 hover:shadow-lg hover:border-emerald-500/30 transition-all flex flex-col"
                  >
                    <div className="p-8 flex-1 flex flex-col">
                      <div className="flex items-center gap-3 text-xs font-semibold text-slate-400 mb-4 uppercase tracking-wider">
                        <span>Camp Everyday</span>
                        <span>•</span>
                        <span>{Math.ceil(post.content.split(/\s+/).length / 200)} min</span>
                      </div>

                      <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-emerald-600 transition-colors leading-tight">
                        {post.title}
                      </h3>

                      <p className="text-slate-600 line-clamp-3 mb-6 flex-1 text-sm leading-relaxed">
                        {post.description}
                      </p>

                      <div className="flex items-center text-sm font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors mt-auto">
                        Read Article
                        <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}

        {/* CTA */}
        <div className="text-center bg-slate-900 rounded-3xl p-12 md:p-20 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay" />
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/20 via-transparent to-transparent opacity-50" />

          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              Ready to transform your campground?
            </h2>
            <p className="text-lg text-slate-300 mb-10">
              Join hundreds of campground owners who use Camp Everyday to save time and increase bookings.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/"
                className="w-full sm:w-auto px-8 py-4 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/25"
              >
                Get Started Free
              </Link>
              <Link
                href="/owners"
                className="w-full sm:w-auto px-8 py-4 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-all border border-white/10"
              >
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 text-white mt-12 pt-12 border-t border-slate-800">
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
