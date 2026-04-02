'use client';

import { registerUser } from '@/lib/actions/register';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const STORES = [
    { key: 'zhonghe', label: '中和分店' },
    { key: 'xindian', label: '新店分店' },
];

export default function RegisterPage() {
    const [form, setForm] = useState({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
        storeKey: '',
        employmentType: 'parttime' as 'fulltime' | 'parttime',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const router = useRouter();

    const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (form.password !== form.confirmPassword) {
            setError('兩次輸入的密碼不一致');
            return;
        }
        if (!form.storeKey) {
            setError('請選擇您的分店');
            return;
        }
        if (form.password.length < 6) {
            setError('密碼至少需要 6 個字元');
            return;
        }

        setLoading(true);
        setError(null);

        const result = await registerUser({
            email: form.email,
            password: form.password,
            fullName: form.fullName,
            storeKey: form.storeKey,
            employmentType: form.employmentType,
        });

        if (!result.success) {
            setError(result.error ?? '申請失敗，請再試一次');
            setLoading(false);
        } else {
            setSuccess(`申請成功！歡迎加入${result.storeName}的團隊 🧇 請等候主管審核後即可登入。`);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4"
                style={{ background: 'linear-gradient(135deg, #ffdda9 0%, #ffeed4 50%, #ffe4b8 100%)' }}>
                <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-sm w-full text-center">
                    <img src="/logo.svg" alt="小木屋鬆餅" className="w-16 h-16 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-800 mb-3">申請成功！</h2>
                    <p className="text-gray-500 text-sm leading-relaxed mb-8">{success}</p>
                    <button
                        onClick={() => router.push('/login')}
                        className="w-full py-3 text-white font-bold rounded-xl text-sm"
                        style={{ background: 'linear-gradient(135deg, #654321, #8b5e3c)' }}
                    >
                        返回登入頁
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4"
            style={{ background: 'linear-gradient(135deg, #ffdda9 0%, #ffeed4 50%, #ffe4b8 100%)' }}>
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl" style={{ background: 'rgba(101,67,33,0.08)' }} />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-3xl" style={{ background: 'rgba(101,67,33,0.06)' }} />
            </div>

            <div className="relative w-full max-w-md">
                <div className="rounded-3xl shadow-2xl border overflow-hidden"
                    style={{ background: 'rgba(255,248,235,0.85)', backdropFilter: 'blur(12px)', borderColor: '#e8c99a' }}>
                    {/* Brand Header */}
                    {/* Brand Header */}
                    <div className="px-6 md:px-8 pt-8 pb-6 text-center"
                        style={{ background: 'linear-gradient(135deg, #654321 0%, #8b5e3c 60%, #a0714f 100%)' }}>
                        <div className="flex justify-center mb-2">
                            <img
                                src="/logo.svg"
                                alt="小木屋鬆餅 Logo"
                                className="w-14 h-14 drop-shadow-lg"
                            />
                        </div>
                        <h1 className="text-xl font-black text-white tracking-wide">小木屋鬆餅</h1>
                        <p className="text-xs mt-1" style={{ color: '#ffdda9' }}>員工排班系統 · 新員工申請</p>
                    </div>

                    {/* Form */}
                    <div className="px-6 md:px-8 py-7">
                        <h2 className="text-lg font-bold text-gray-800 mb-1">建立帳號</h2>
                        <p className="text-gray-400 text-xs mb-5">填寫資料後等候主管審核，約 1 個工作天。</p>

                        <form className="space-y-4" onSubmit={handleSubmit}>
                            {/* 姓名 */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">姓名</label>
                                <input type="text" required
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#8b5e3c] focus:border-transparent placeholder:text-gray-400"
                                    placeholder="請輸入真實姓名"
                                    value={form.fullName} onChange={e => set('fullName', e.target.value)}
                                />
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">電子郵件</label>
                                <input type="email" required
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#8b5e3c] focus:border-transparent placeholder:text-gray-400"
                                    placeholder="your@email.com"
                                    value={form.email} onChange={e => set('email', e.target.value)}
                                />
                            </div>

                            {/* 分店 + 職務類型（兩欄） */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">分店</label>
                                    <select required value={form.storeKey} onChange={e => set('storeKey', e.target.value)}
                                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#8b5e3c] focus:border-transparent">
                                        <option value="">請選擇</option>
                                        {STORES.map(s => (
                                            <option key={s.key} value={s.key}>{s.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">職務類型</label>
                                    <select value={form.employmentType} onChange={e => set('employmentType', e.target.value)}
                                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#8b5e3c] focus:border-transparent">
                                        <option value="parttime">⏰ 工讀生</option>
                                        <option value="fulltime">👔 全職</option>
                                    </select>
                                </div>
                            </div>

                            {/* 密碼 */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">密碼</label>
                                <input type="password" required minLength={6}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#8b5e3c] focus:border-transparent placeholder:text-gray-400"
                                    placeholder="至少 6 個字元"
                                    value={form.password} onChange={e => set('password', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">確認密碼</label>
                                <input type="password" required
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#8b5e3c] focus:border-transparent placeholder:text-gray-400"
                                    placeholder="再輸入一次密碼"
                                    value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)}
                                />
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded-xl">
                                    ⚠️ {error}
                                </div>
                            )}

                            <button type="submit" disabled={loading}
                                className="w-full py-3 text-white font-bold rounded-xl shadow-lg transition-all disabled:opacity-60 text-sm mt-1"
                                style={{ background: 'linear-gradient(135deg, #654321, #8b5e3c)', boxShadow: '0 4px 15px rgba(101,67,33,0.3)' }}>
                                {loading ? '申請中...' : '送出申請'}
                            </button>
                        </form>

                        <div className="mt-5 text-center">
                            <p className="text-gray-400 text-sm">
                                已有帳號？{' '}
                                <Link href="/login" className="font-bold hover:underline" style={{ color: '#8b5e3c' }}>返回登入</Link>
                            </p>
                        </div>
                    </div>
                </div>

                <p className="text-center text-xs text-gray-400 mt-5">
                    © 2026 小木屋鬆餅 · 中和分店 · 新店分店
                </p>
            </div>
        </div>
    );
}
