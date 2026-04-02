// app/select-store/page.tsx — Server Component
// Manager 到這頁選擇要管理哪間分店
// 選完後 selectStore() 寫 cookie 跳 /schedule

import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import { selectStore } from '@/lib/actions/stores';
import type { Database } from '@/lib/types/database';
import { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { StoreSelectButton } from '@/components/auth/StoreSelectButton';

export default async function SelectStorePage() {
    // anon client 驗證身份
    const supabase = (await createClient()) as unknown as SupabaseClient<Database>;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    // service role client 查 manager_stores（繞過 RLS，確保兩間店都查得到）
    const admin = createServiceClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: managerStoreRows } = await admin
        .from('manager_stores')
        .select('store_id')
        .eq('manager_id', user.id);

    const storeIds = (managerStoreRows ?? []).map(r => r.store_id);

    if (storeIds.length === 0) redirect('/schedule');

    if (storeIds.length === 1) {
        const cookieStore = await cookies();
        cookieStore.set('selected_store_id', storeIds[0], { httpOnly: true, path: '/', maxAge: 60 * 60 * 24 * 7 });
        redirect('/schedule');
    }

    // 取得各店完整資料
    const { data: stores } = await admin
        .from('stores')
        .select('id, name')
        .in('id', storeIds);

    return (
        <div
            className="min-h-screen flex items-center justify-center p-6"
            style={{ background: 'linear-gradient(135deg, #ffdda9 0%, #ffeed4 50%, #ffe4b8 100%)' }}
        >
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl" style={{ background: 'rgba(101,67,33,0.08)' }} />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-3xl" style={{ background: 'rgba(101,67,33,0.06)' }} />
            </div>

            <div className="relative w-full max-w-sm">
                <div className="rounded-3xl shadow-2xl border overflow-hidden"
                    style={{ background: 'rgba(255,248,235,0.9)', backdropFilter: 'blur(12px)', borderColor: '#e8c99a' }}>

                    {/* Header */}
                    <div className="px-8 pt-8 pb-6 text-left"
                        style={{ background: 'linear-gradient(135deg, #654321 0%, #8b5e3c 60%, #a0714f 100%)' }}>
                        <img src="/logo.svg" alt="小木屋鬆餅" className="w-14 h-14 mb-3 drop-shadow-lg" />
                        <h1 className="text-xl font-black text-white">請選擇分店</h1>
                        <p className="text-xs mt-1" style={{ color: '#ffdda9' }}>選擇後可從左上角切換</p>
                    </div>

                    {/* Store Cards */}
                    <div className="px-6 py-6 space-y-3">
                        {(stores ?? []).map(store => (
                            <form key={store.id} action={selectStore}>
                                <input type="hidden" name="storeId" value={store.id} />
                                <StoreSelectButton
                                    className="w-full flex items-center justify-between px-5 py-4 rounded-2xl border-2 transition-all group hover:scale-[1.02] active:scale-[0.98]"
                                    style={{
                                        borderColor: '#e8c99a',
                                        background: 'white',
                                    }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                                            style={{ background: 'linear-gradient(135deg, #654321, #8b5e3c)' }}>
                                            🏪
                                        </div>
                                        <div className="text-left">
                                            <div className="font-bold text-gray-800">{store.name}</div>
                                            <div className="text-xs text-gray-400">點擊進入管理</div>
                                        </div>
                                    </div>
                                    <svg className="w-5 h-5 text-gray-400 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </StoreSelectButton>
                            </form>
                        ))}
                    </div>

                    <p className="text-center text-xs text-gray-400 pb-6">© 2026 小木屋鬆餅</p>
                </div>
            </div>
        </div>
    );
}
