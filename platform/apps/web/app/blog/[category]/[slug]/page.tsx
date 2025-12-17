import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { PublicHeader } from '../../../../components/public/PublicHeader';
import { getPostBySlug, getPostsByCategory } from '../../../../lib/blog';
import { ArrowLeft, Calendar, Clock } from 'lucide-react';

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
            title: 'Post Not Found',
        };
    }

    return {
        title: `${post.title} - Camp Everyday Blog`,
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
        .replace(/^#\s+(.+)$/m, '') // Remove H1
        .replace(/\*\*Meta Description:\*\*.+$/m, '') // Remove Meta Description
        .replace(/\*\*Target Keywords:\*\*.+$/m, '')
        .replace(/\*\*Word Count:\*\*.+$/m, '')
        .trim();

    return (
        <div className="min-h-screen bg-white">
            <PublicHeader />

            <div className="max-w-4xl mx-auto px-6 py-16 pt-24">
                {/* Breadcrumb */}
                <Link
                    href="/blog"
                    className="inline-flex items-center text-sm text-slate-500 hover:text-emerald-600 mb-8 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Blog
                </Link>

                {/* Header */}
                <header className="mb-12">
                    <div className="flex items-center gap-4 text-sm text-slate-500 mb-4">
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full font-medium capitalize">
                            {post.category}
                        </span>
                        <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {readTime} min read
                        </span>
                    </div>

                    <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 leading-tight">
                        {post.title}
                    </h1>

                    {post.description && (
                        <p className="text-xl text-slate-600 leading-relaxed">
                            {post.description}
                        </p>
                    )}
                </header>

                {/* Content */}
                <article className="prose prose-lg prose-slate max-w-none prose-headings:font-bold prose-headings:text-slate-900 prose-a:text-emerald-600 hover:prose-a:text-emerald-500">
                    <ReactMarkdown
                        components={{
                            // Handle internal links specially if needed, but default is fine
                            a: ({ node, ...props }) => {
                                // Check if it's an internal placeholder link [LINK: category/slug]
                                // Note: Our prompt generated [LINK: category/slug] in plain text usually, 
                                // but if it's an actual markdown link, this catches it.
                                return <a {...props} className="text-emerald-600 hover:text-emerald-500 no-underline hover:underline" />
                            }
                        }}
                    >
                        {cleanContent}
                    </ReactMarkdown>
                </article>

                {/* Newsletter CTA */}
                <div className="mt-16 bg-slate-50 rounded-2xl p-8 md:p-12 border border-slate-100">
                    <div className="max-w-2xl mx-auto text-center">
                        <h3 className="text-2xl font-bold text-slate-900 mb-4">
                            Subscribe to Camp Everyday
                        </h3>
                        <p className="text-slate-600 mb-8">
                            Get the latest camping tips and industry insights delivered straight to your inbox.
                        </p>
                        <form className="flex gap-2 max-w-md mx-auto">
                            <input
                                type="email"
                                placeholder="your@email.com"
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

            {/* Footer */}
            <footer className="bg-slate-900 text-white mt-0">
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
