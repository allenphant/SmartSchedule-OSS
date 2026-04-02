'use client';

import { useState, useEffect } from 'react';
import { completeProfile } from '@/lib/actions/onboarding';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Store, User, Briefcase, DollarSign } from 'lucide-react';

export default function OnboardingPage() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [stores, setStores] = useState<{ id: string, name: string }[]>([]);
    const [fetchingStores, setFetchingStores] = useState(true);

    const supabase = createClient();

    useEffect(() => {
        async function fetchStores() {
            setFetchingStores(true);
            const { data, error } = await supabase.rpc('get_all_stores_public');
            if (data) {
                setStores(data);
            }
            setFetchingStores(false);
        }
        fetchStores();
    }, []);

    async function handleSubmit(formData: FormData) {
        setLoading(true);
        setError(null);

        const result = await completeProfile(formData);

        if (result?.error) {
            setError(result.error);
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4"
            style={{ background: 'linear-gradient(135deg, #ffdda9 0%, #ffeed4 50%, #ffe4b8 100%)' }}>

            <div className="bg-white/90 backdrop-blur-md w-full max-w-lg rounded-2xl shadow-xl border border-orange-100 overflow-hidden">
                <div className="h-2 bg-gradient-to-r from-amber-700 to-amber-500" />

                <div className="p-8">
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-black text-gray-800 mb-2">👋 歡迎加入小木屋鬆餅</h1>
                        <p className="text-gray-500 text-sm">請完成您的個人檔案以開始使用排班系統</p>
                    </div>

                    <form action={handleSubmit} className="space-y-5">
                        {/* 姓名 */}
                        <div>
                            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-1.5">
                                <User className="w-4 h-4 text-amber-600" /> 真實姓名
                            </label>
                            <input
                                name="fullName"
                                required
                                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-amber-400 focus:outline-none text-gray-900"
                                placeholder="請輸入本名 (方便店長辨識)"
                            />
                        </div>

                        {/* 分店選擇 (改為下拉選單) */}
                        <div>
                            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-1.5">
                                <Store className="w-4 h-4 text-amber-600" /> 選擇分店
                            </label>
                            <div className="relative">
                                <select
                                    name="storeId"
                                    required
                                    disabled={fetchingStores}
                                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-amber-400 focus:outline-none appearance-none bg-white text-gray-900"
                                    defaultValue=""
                                >
                                    <option value="" disabled>
                                        {fetchingStores ? '載入分店清單中...' : '請選擇您所屬的分店'}
                                    </option>
                                    {stores.map(store => (
                                        <option key={store.id} value={store.id}>
                                            {store.name}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute right-4 top-3 pointer-events-none text-gray-400">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </div>
                        </div>

                        {/* 類型 (Role 預設為 Staff，不顯示) */}
                        <div>
                            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-1.5">
                                <Briefcase className="w-4 h-4 text-amber-600" /> 類型
                            </label>
                            <select name="type" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-amber-400 focus:outline-none text-gray-900">
                                <option value="parttime">兼職 (PT)</option>
                                <option value="fulltime">正職 (FT)</option>
                            </select>
                        </div>

                        {error && (
                            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg text-center font-bold">
                                ⚠️ {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-3 font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 ${loading
                                    ? 'bg-gray-400 text-gray-100 cursor-not-allowed opacity-80'
                                    : 'bg-slate-800 hover:bg-slate-900 text-white'
                                }`}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin w-5 h-5" />
                                    <span>設定中...</span>
                                </>
                            ) : '完成設定並進入系統'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
