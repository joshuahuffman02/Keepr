import { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ArrowRight } from "lucide-react";
import { PublicHeader } from "../../components/public/PublicHeader";

export const metadata: Metadata = {
  title: "Blog - Camp Everyday",
  description: "Camping tips, destination guides, and industry insights from Camp Everyday.",
};

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <PublicHeader />
      <div className="max-w-4xl mx-auto px-6 py-16 pt-24">
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

        {/* Coming Soon Card */}
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center mb-12">
          <div className="w-24 h-24 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Coming Soon</h2>
          <p className="text-slate-600 max-w-md mx-auto mb-8">
            We&apos;re working on amazing content for you! Our blog will feature camping tips, 
            destination guides, and insights from campground owners.
          </p>
          
          {/* Subscribe Form */}
          <div className="max-w-md mx-auto">
            <p className="text-sm text-slate-500 mb-4">Get notified when we launch:</p>
            <form className="flex gap-2">
              <input
                type="email"
                placeholder="your@email.com"
                className="flex-1 px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
              />
              <button
                type="submit"
                className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-lg hover:from-emerald-500 hover:to-teal-500 transition-all shadow-lg shadow-emerald-500/20"
              >
                Notify Me
              </button>
            </form>
          </div>
        </div>

        {/* Preview Categories */}
        <div className="mb-12">
          <h3 className="text-lg font-semibold text-slate-900 mb-6 text-center">Topics We&apos;ll Cover</h3>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100">
              <span className="text-2xl mb-2 block">⛺</span>
              <span className="font-medium text-slate-900">Camping Tips</span>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100">
              <span className="text-2xl mb-2 block">🗺️</span>
              <span className="font-medium text-slate-900">Destination Guides</span>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100">
              <span className="text-2xl mb-2 block">🚐</span>
              <span className="font-medium text-slate-900">RV Life</span>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100">
              <span className="text-2xl mb-2 block">👨‍👩‍👧‍👦</span>
              <span className="font-medium text-slate-900">Family Camping</span>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100">
              <span className="text-2xl mb-2 block">🏕️</span>
              <span className="font-medium text-slate-900">Owner Stories</span>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100">
              <span className="text-2xl mb-2 block">🔧</span>
              <span className="font-medium text-slate-900">Gear Reviews</span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <p className="text-slate-600 mb-4">In the meantime, start planning your next adventure:</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors"
          >
            Find Campgrounds
            <ArrowRight className="w-4 h-4" />
          </Link>
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
                <li><a href="/" className="text-slate-300 hover:text-white transition-colors">Cabins</a></li>
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
            <div className="flex items-center gap-4">
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" /></svg>
              </a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
              </a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z" /></svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
