import React, { useState } from 'react';
import { ChefHat, ArrowRight, CheckCircle2, Star, Sparkles, Mail, Lock, Eye, EyeOff, Loader2, AlertTriangle, Menu, X } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface LandingPageProps {
    onSkipAuth?: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onSkipAuth }) => {
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Auth State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            if (authMode === 'signup') {
                const { error } = await supabase!.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                setMessage('Check your email for a confirmation link!');
            } else {
                const { error } = await supabase!.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleAuth = async () => {
        setLoading(true);
        setError(null);
        try {
            const { error } = await supabase!.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin + window.location.pathname,
                },
            });
            if (error) throw error;
        } catch (err: any) {
            setError(err.message || 'An error occurred');
            setLoading(false);
        }
    };

    const openAuth = (mode: 'signin' | 'signup') => {
        setAuthMode(mode);
        setIsAuthModalOpen(true);
        setError(null);
        setMessage(null);
    };

    // Config Check
    if (!isSupabaseConfigured || !supabase) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                    <h1 className="text-xl font-bold text-gray-900 mb-2">Setup Required</h1>
                    <p className="text-gray-600 mb-6">Supabase credentials missing. Please configure .env</p>
                    {onSkipAuth && (
                        <button onClick={onSkipAuth} className="text-indigo-600 font-medium hover:underline">
                            Continue Offline
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-orange-100 selection:text-orange-900">

            {/* Navigation */}
            <nav className="fixed w-full bg-white/80 backdrop-blur-md z-50 border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-20">
                        <div className="flex items-center gap-2">
                            <img src="/QookCommander-home-cook-management-app-logo.png" alt="QookCommander Logo" className="h-10 w-auto" />
                        </div>

                        {/* Desktop Menu */}
                        <div className="hidden md:flex items-center gap-8">
                            <a href="#features" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Features</a>
                            <a href="#how-it-works" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">How it works</a>
                            <div className="flex items-center gap-4 ml-4">
                                <button
                                    onClick={() => openAuth('signin')}
                                    className="text-sm font-semibold text-gray-900 hover:text-orange-600 transition-colors"
                                >
                                    Log in
                                </button>
                                <button
                                    onClick={() => openAuth('signup')}
                                    className="px-5 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-full hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
                                >
                                    Get Started
                                </button>
                            </div>
                        </div>

                        {/* Mobile Menu Button */}
                        <div className="md:hidden">
                            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-gray-600">
                                {isMobileMenuOpen ? <X /> : <Menu />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu */}
                {isMobileMenuOpen && (
                    <div className="md:hidden bg-white border-t border-gray-100 py-4 px-4 flex flex-col gap-4 shadow-xl">
                        <a href="#features" onClick={() => setIsMobileMenuOpen(false)} className="text-base font-medium text-gray-700 py-2">Features</a>
                        <button onClick={() => { openAuth('signin'); setIsMobileMenuOpen(false); }} className="text-left text-base font-medium text-gray-700 py-2">Log in</button>
                        <button onClick={() => { openAuth('signup'); setIsMobileMenuOpen(false); }} className="btn-primary w-full py-3 bg-orange-600 text-white rounded-lg font-bold">Get Started</button>
                    </div>
                )}
            </nav>

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-orange-200/30 rounded-full blur-3xl -z-10 opacity-50 pointer-events-none" />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-100 text-orange-700 text-xs font-bold uppercase tracking-wide mb-8 animate-fade-in-up">
                        <Sparkles className="w-3 h-3" />
                        <span>AI-Powered Kitchen Assistant</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-gray-900 mb-8 leading-[1.1]">
                        Master Your Kitchen <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-red-600">Without the Chaos</span>
                    </h1>

                    <p className="max-w-2xl mx-auto text-xl text-gray-600 mb-10 leading-relaxed">
                        Stop worrying about "what's for dinner". QookCommander generates personalized weekly meal plans and organized grocery lists in seconds. The ultimate AI home cook management tool.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button
                            onClick={() => openAuth('signup')}
                            className="w-full sm:w-auto px-8 py-4 bg-gray-900 text-white font-bold rounded-full hover:bg-gray-800 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 flex items-center justify-center gap-2 group"
                        >
                            Start Planning Free
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                        {onSkipAuth && (
                            <button onClick={onSkipAuth} className="text-sm text-gray-500 hover:text-gray-900 font-medium underline underline-offset-4 px-4 py-2">
                                Try Offline Demo
                            </button>
                        )}
                    </div>

                    {/* Social Proof / Stats */}
                    <div className="mt-16 flex flex-wrap justify-center gap-8 md:gap-16 opacity-80">
                        {['100% Personalized', 'Saves 2+ Hours/Week', 'Zero Food Waste'].map((stat, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                                <span className="font-semibold text-gray-700">{stat}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* How It Works - Visual Flow Section */}
                <div className="mt-32 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="relative">
                        <div className="text-center mb-16">
                            <span className="text-orange-600 font-bold tracking-wide uppercase text-sm">See It In Action</span>
                            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mt-2 mb-4">From Preference to Plate</h2>
                            <p className="text-gray-600 text-lg max-w-2xl mx-auto">Experience the seamless flow of QookCommander. Set your tastes, get your plan, and shop with ease.</p>
                        </div>

                        {/* Step 1: Preferences */}
                        <div className="relative mb-24 last:mb-0 group">
                            <div className="bg-gray-50 rounded-3xl p-8 md:p-12 border border-gray-100 overflow-hidden relative">
                                <div className="grid md:grid-cols-2 gap-12 items-center">
                                    <div>
                                        <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-6 text-2xl font-bold text-orange-600">1</div>
                                        <h3 className="text-3xl font-bold text-gray-900 mb-4">Tell Us What You Love</h3>
                                        <p className="text-gray-600 text-lg leading-relaxed">
                                            Vegetarian? Keto? Love spicy food? Just set your preferences once.
                                            QookCommander supports diverse dietary needs including detailed regional Indian cuisine preferences.
                                        </p>
                                    </div>
                                    <div className="relative perspective-1000">
                                        <div className="relative z-10 rounded-xl overflow-hidden shadow-2xl border-4 border-white transform transition-transform group-hover:scale-[1.02] duration-500">
                                            <img src="/qook-app-preferences-setup.png" alt="Preferences Setup" className="w-full h-auto" />
                                        </div>
                                        {/* Decorative elements */}
                                        <div className="absolute -inset-4 bg-orange-100 rounded-full blur-2xl opacity-40 -z-10"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Step 2: The Generated Plan (Primary) */}
                        <div className="relative mb-24 last:mb-0">
                            <div className="bg-gray-900 rounded-3xl p-8 md:p-12 text-white overflow-hidden relative shadow-2xl">
                                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-orange-600/30 to-purple-600/30 rounded-full blur-3xl opacity-40 -translate-y-1/2 translate-x-1/2"></div>

                                <div className="text-center max-w-3xl mx-auto mb-16 relative z-10">
                                    <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center mx-auto mb-6 text-2xl font-bold text-white">2</div>
                                    <h3 className="text-3xl md:text-4xl font-bold mb-4">Your Perfect Weekly Plan</h3>
                                    <p className="text-gray-300 text-lg">AI-crafted menus that optimize ingredients and minimize waste. Available in English and Hindi.</p>
                                </div>

                                <div className="relative h-[400px] md:h-[600px] w-full flex justify-center items-start perspective-1000">
                                    {/* English Plan (Left/Back) */}
                                    <div className="absolute w-[80%] md:w-[60%] left-0 md:left-10 top-10 transform -rotate-6 opacity-70 scale-95 origin-bottom-right transition-all duration-700 hover:opacity-100 hover:z-20 hover:scale-100 hover:rotate-0">
                                        <div className="rounded-xl overflow-hidden shadow-2xl border border-gray-700 bg-gray-800">
                                            <div className="bg-gray-900/50 px-4 py-2 flex justify-between items-center text-xs text-gray-400 border-b border-gray-700">
                                                <span>Hindi Plan</span>
                                            </div>
                                            <img src="/qook-app-weekly-meal-planner.png" alt="Hindi Meal Plan" className="w-full h-auto blur-[1px] hover:blur-none transition-all" />
                                        </div>
                                    </div>

                                    {/* English Plan (Main/Front) */}
                                    <div className="absolute w-[90%] md:w-[65%] z-10 transform translate-y-0 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-500 hover:-translate-y-2">
                                        <div className="rounded-xl overflow-hidden shadow-2xl border border-gray-700 bg-gray-900">
                                            <div className="bg-gray-800 px-4 py-2 flex items-center gap-2 border-b border-gray-700">
                                                <div className="flex gap-1.5">
                                                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                                                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                                                    <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                                                </div>
                                                <span className="text-xs text-gray-400 font-mono ml-4">weekly_plan_final.qook</span>
                                            </div>
                                            <img src="/qook-app-weekly-meal-planner.png" alt="English Meal Plan" className="w-full h-auto" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Step 3: Mobile & Grocery & Share */}
                        <div className="grid md:grid-cols-2 gap-8 mb-24">
                            {/* Grocery & Share */}
                            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-lg hover:shadow-xl transition-shadow flex flex-col">
                                <div className="mb-8">
                                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-6 text-2xl font-bold text-green-600">3</div>
                                    <h3 className="text-2xl font-bold text-gray-900 mb-3">Shop & Share in Seconds</h3>
                                    <p className="text-gray-600">
                                        Get an organized shopping list instantly. Share it with family or your cook with a single click.
                                    </p>
                                </div>
                                <div className="relative flex-grow flex items-end justify-center min-h-[300px] overflow-hidden rounded-2xl bg-gray-50 pt-8">
                                    {/* Desktop List */}
                                    <img src="/qook-app-grocery-shopping-list.png" className="w-[80%] rounded-t-xl shadow-lg border border-gray-200 transform translate-y-2" alt="Grocery List" />
                                    {/* Share Card Overlay */}
                                    <div className="absolute bottom-8 right-4 w-1/2 transform rotate-6 shadow-2xl rounded-lg overflow-hidden border border-gray-200">
                                        <img src="/qook-app-share-plan-card.png" className="w-full" alt="Share Card" />
                                    </div>
                                </div>
                            </div>

                            {/* Mobile View */}
                            <div className="bg-gray-900 rounded-3xl p-8 text-white shadow-lg overflow-hidden relative flex flex-col">
                                <div className="relative z-10 mb-8">
                                    <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-6 text-2xl font-bold text-white">4</div>
                                    <h3 className="text-2xl font-bold mb-3">Perfect on Mobile</h3>
                                    <p className="text-gray-400">
                                        Access your plans and lists anywhere. The responsive design works perfectly on your phone.
                                    </p>
                                </div>
                                <div className="flex-grow flex justify-center perspective-1000 relative z-10">
                                    <div className="w-[280px] rounded-[2.5rem] bg-gray-800 border-8 border-gray-800 shadow-2xl overflow-hidden relative transform rotate-1 hover:rotate-0 transition-transform duration-500">
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-800 rounded-b-xl z-20"></div>
                                        <img src="/qook-app-mobile-view.png" className="w-full h-full object-cover" alt="Mobile App" />
                                    </div>
                                </div>
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-blue-500/20 rounded-full blur-3xl -z-0"></div>
                            </div>
                        </div>

                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section id="features" className="py-24 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <h2 className="text-3xl font-bold text-gray-900 mb-4">Everything you need to eat better</h2>
                        <p className="text-gray-600 text-lg">Powerful features designed to simplify your cooking routine.</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            { icon: Sparkles, title: "AI-Generated Plans", desc: "Get a full week of meals tailored to your diet, allergies, and taste preferences instantly." },
                            { icon: ChefHat, title: "Smart Recipes", desc: "Detailed, easy-to-follow recipes for every meal in your plan." },
                            { icon: CheckCircle2, title: "Auto Grocery List", desc: "Ingredients are automatically aggregated into a sorted shopping checklist." }
                        ].map((feature, i) => (
                            <div key={i} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-6">
                                    <feature.icon className="w-6 h-6 text-orange-600" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                                <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24 bg-white relative overflow-hidden">
                <div className="max-w-5xl mx-auto px-4 relative z-10 bg-gray-900 rounded-3xl p-12 md:p-20 text-center shadow-2xl overflow-hidden">
                    <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-orange-500 rounded-full blur-[100px] opacity-20 translate-x-1/2 -translate-y-1/2"></div>
                    <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Ready to take control?</h2>
                    <p className="text-gray-400 text-lg mb-10 max-w-2xl mx-auto">Join thousands of home cooks who are saving time and eating better with QookCommander.</p>

                    <button
                        onClick={() => openAuth('signup')}
                        className="px-10 py-4 bg-white text-gray-900 font-bold rounded-full hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                    >
                        Get Started Now
                    </button>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-gray-50 py-12 border-t border-gray-200">
                <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex flex-col items-center md:items-start gap-4">
                        <div className="flex items-center gap-2">
                            <img src="/QookCommander-home-cook-management-app-logo.png" alt="QookCommander Logo" className="w-10 h-10" />
                            <span className="text-xl font-bold tracking-tight text-gray-900">QookCommander</span>
                        </div>
                        <div className="text-sm text-gray-500 space-y-1 text-center md:text-left">
                            <p>© {new Date().getFullYear()} QookCommander. All rights reserved.</p>
                            <p>Owned by <a href="https://qook.in" className="hover:text-orange-600 transition-colors">Qook.in</a></p>
                        </div>
                    </div>

                    <div className="flex flex-col items-center md:items-end gap-2 text-sm text-gray-600">
                        <h4 className="font-bold text-gray-900">Contact Us</h4>
                        <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-orange-500" />
                            <a href="mailto:akshaydewalwar1@gmail.com" className="hover:text-orange-600 transition-colors">akshaydewalwar1@gmail.com</a>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-orange-500">PRO</span>
                            <span>+91 8329265013</span>
                        </div>
                    </div>
                </div>
            </footer>

            {/* integrated Auth Modal */}
            {isAuthModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
                        onClick={() => setIsAuthModalOpen(false)}
                    ></div>

                    {/* Modal Card */}
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden animate-scale-in">
                        <div className="p-8">
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-bold text-gray-900">{authMode === 'signin' ? 'Welcome Back' : 'Create Account'}</h2>
                                <p className="text-gray-500 text-sm mt-1">{authMode === 'signin' ? 'Enter your details to sign in' : 'Start your journey today'}</p>
                            </div>

                            <div className="space-y-4">
                                <button
                                    onClick={handleGoogleAuth}
                                    disabled={loading}
                                    className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-3"
                                >
                                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
                                    Continue with Google
                                </button>

                                <div className="relative flex py-2 items-center">
                                    <div className="flex-grow border-t border-gray-200"></div>
                                    <span className="flex-shrink-0 mx-4 text-gray-400 text-xs uppercase font-medium">Or with email</span>
                                    <div className="flex-grow border-t border-gray-200"></div>
                                </div>

                                <form onSubmit={handleEmailAuth} className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-gray-700 ml-1">Email</label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                required
                                                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all text-sm font-medium"
                                                placeholder="hello@example.com"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-gray-700 ml-1">Password</label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                required
                                                className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all text-sm font-medium"
                                                placeholder="••••••••"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                            >
                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">{error}</div>}
                                    {message && <div className="p-3 bg-green-50 text-green-600 text-sm rounded-lg border border-green-100">{message}</div>}

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-70 flex items-center justify-center gap-2"
                                    >
                                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                        {authMode === 'signin' ? 'Sign In' : 'Create Account'}
                                    </button>
                                </form>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 text-center text-sm">
                            <span className="text-gray-500">{authMode === 'signin' ? "Don't have an account?" : "Already have an account?"}</span>
                            <button
                                onClick={() => openAuth(authMode === 'signin' ? 'signup' : 'signin')}
                                className="ml-2 font-bold text-orange-600 hover:underline"
                            >
                                {authMode === 'signin' ? 'Sign up' : 'Log in'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default LandingPage;
