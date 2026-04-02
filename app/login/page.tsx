'use client';

import { createClient } from '@/lib/supabase/client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, AlertTriangle, ExternalLink } from 'lucide-react';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const supabase = createClient();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            setError('帳號或密碼錯誤，請再試一次');
            setLoading(false);
        } else {
            router.push('/schedule');
            router.refresh();
        }
    };

    const handleGoogleLogin = async () => {
        // 提醒使用者檢查是否在 WebView 環境
        const confirmLogin = confirm('【登入提醒】\n\n如果您正在使用 LINE 或 Facebook 內建瀏覽器，Google 登入可能會失敗（顯示 403 錯誤）。\n\n建議您點擊右上角「...」並選擇「使用預設瀏覽器開啟」再進行登入。\n\n確定要繼續嗎？');
        
        if (!confirmLogin) return;

        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                },
            },
        });
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4"
            style={{ background: 'linear-gradient(135deg, #ffdda9 0%, #ffeed4 50%, #ffe4b8 100%)' }}>
            {/* Background decorative circles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl" style={{ background: 'rgba(101,67,33,0.08)' }} />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-3xl" style={{ background: 'rgba(101,67,33,0.06)' }} />
            </div>

            <div className="relative w-full max-w-md">
                {/* Card */}
                <div className="rounded-3xl shadow-2xl border overflow-hidden"
                    style={{ background: 'rgba(255,248,235,0.85)', backdropFilter: 'blur(12px)', borderColor: '#e8c99a' }}>
                    {/* Brand Header */}
                    <div className="px-6 md:px-8 pt-10 pb-8 text-center"
                        style={{ background: 'linear-gradient(135deg, #654321 0%, #8b5e3c 60%, #a0714f 100%)' }}>
                        <div className="flex justify-center mb-3">
                            <img
                                src="/logo.svg"
                                alt="小木屋鬆餅 Logo"
                                className="w-16 h-16 drop-shadow-lg"
                            />
                        </div>
                        <h1 className="text-2xl font-black text-white tracking-wide drop-shadow-sm">
                            小木屋鬆餅
                        </h1>
                        <p className="text-sm mt-1 font-medium" style={{ color: '#ffdda9' }}>
                            員工排班系統
                        </p>
                        <div className="mt-3 inline-flex items-center gap-1.5 text-white text-xs px-3 py-1 rounded-full font-medium"
                            style={{ background: 'rgba(255,255,255,0.18)' }}>
                            <span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse" />
                            SmartSchedule v3.0
                        </div>
                    </div>

                    {/* Form */}
                    <div className="px-6 md:px-8 py-8">
                        <h2 className="text-lg font-bold text-gray-800 mb-1">員工登入</h2>
                        <p className="text-gray-400 text-sm mb-6">請輸入您的帳號與密碼</p>

                        <form className="space-y-4" onSubmit={handleLogin}>
                            <div>
                                <label htmlFor="email" className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">
                                    電子郵件
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all placeholder:text-gray-400"
                                    placeholder="your@email.com"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                />
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">
                                    密碼
                                </label>
                                <input
                                    id="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all placeholder:text-gray-400"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                />
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
                                    <span>⚠️</span> {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 text-white font-bold rounded-xl shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed text-sm tracking-wide mt-2"
                                style={{ background: 'linear-gradient(135deg, #654321, #8b5e3c)', boxShadow: '0 4px 15px rgba(101,67,33,0.3)' }}
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <Loader2 className="animate-spin h-4 w-4" />
                                        登入中...
                                    </span>
                                ) : '登入'}
                            </button>
                        </form>

                        <div className="flex items-center gap-4 my-6">
                            <div className="flex-1 border-t border-gray-300/50"></div>
                            <span className="text-gray-500 text-sm font-medium">或</span>
                            <div className="flex-1 border-t border-gray-300/50"></div>
                        </div>

                        {/* 始終顯示的 WebView 警告 */}
                        <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col gap-2 shadow-sm">
                            <div className="flex items-center gap-2 text-amber-700 font-bold text-sm">
                                <AlertTriangle className="w-5 h-5" />
                                瀏覽器相容性提醒
                            </div>
                            <p className="text-xs text-amber-600 leading-relaxed">
                                若您正在使用 <b>LINE 或 FB 內建瀏覽器</b>，Google 登入將會失效。請點擊右上角「...」選單，並選擇<b>「使用預設瀏覽器開啟」</b>以完成登入。
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={handleGoogleLogin}
                            className="w-full py-3 bg-white text-gray-700 font-bold rounded-xl border border-gray-200 hover:bg-gray-50 transition-all flex items-center justify-center gap-2 shadow-sm text-sm"
                        >
                            <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
                            使用 Google 登入
                        </button>

                        <div className="mt-6 text-center">
                            <p className="text-gray-400 text-sm">
                                還沒有帳號？{' '}
                                <Link href="/register" className="font-bold hover:underline transition-colors" style={{ color: '#8b5e3c' }}>
                                    點此申請加入
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-gray-400 mt-6">
                    © 2026 小木屋鬆餅 · 中和分店 · 新店分店
                </p>
            </div>
        </div>
    );
}
