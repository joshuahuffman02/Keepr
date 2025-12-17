import React from "react";

export function AiFeatures() {
    return (
        <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-20">
            <div className="max-w-7xl mx-auto px-6">
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-full mb-6">
                        <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm font-medium text-emerald-400">AI-Powered Experience</span>
                    </div>
                    <h2 className="text-2xl md:text-4xl font-bold text-white mb-4">
                        Smarter Camping, <span className="text-emerald-400">Private by Design</span>
                    </h2>
                    <p className="text-slate-400 max-w-2xl mx-auto text-lg">
                        Camp Everyday uses AI to help you find the perfect site and get answers faster.
                        But we never compromise on your privacy.
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-8 mb-12">
                    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
                        <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-6">
                            <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-3">Your Data Stays Yours</h3>
                        <p className="text-slate-400">
                            We never share your personal information with AI providers. Your name, email, and contact details are stripped before any AI processing.
                        </p>
                    </div>

                    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
                        <div className="w-12 h-12 bg-violet-500/20 rounded-xl flex items-center justify-center mb-6">
                            <svg className="w-6 h-6 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-3">Anonymized by Default</h3>
                        <p className="text-slate-400">
                            Every interaction is anonymized before AI sees it. We use placeholders like "[Guest]" and "[Site A]" instead of real names.
                        </p>
                    </div>

                    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
                        <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center mb-6">
                            <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-3">You're in Control</h3>
                        <p className="text-slate-400">
                            AI features are optional. You can use Camp Everyday without any AI assistance, or turn specific features on and off anytime.
                        </p>
                    </div>
                </div>

                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 max-w-3xl mx-auto">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div>
                            <h4 className="text-lg font-semibold text-white mb-2">How We Use AI</h4>
                            <ul className="space-y-2 text-slate-400 text-sm">
                                <li className="flex items-start gap-2">
                                    <svg className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    <span><strong className="text-white">Find the right site</strong> – Describe what you need in plain language</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <svg className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    <span><strong className="text-white">Get faster answers</strong> – AI helps staff respond to your questions quickly</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <svg className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    <span><strong className="text-white">Personalized tips</strong> – With your consent, get recommendations based on your preferences</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
