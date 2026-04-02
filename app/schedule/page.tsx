// ============================================
// /app/schedule/page.tsx — Server Component
// ============================================
// 流程：
//   1. 驗證 session（middleware 已擋住未登入者）
//   2. 若 profile 不存在 → 顯示診斷畫面
//   3. 若 manager 有多店 → 讀 selected_store_id cookie
//      - 若沒選 → redirect /select-store
//   4. 用 activeStoreId 抓本月資料
//   5. 傳給 ScheduleClient
// ============================================

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/lib/actions/auth';
import { ScheduleClient } from '@/components/schedule/ScheduleClient';
import { UserRecord, ShiftRecord, AvailabilityRecord } from '@/components/ui/ShiftDetailModal';
import type { Database } from '@/lib/types/database';
import { SupabaseClient, createClient as createServiceClient } from '@supabase/supabase-js';

function initials(name: string): string {
    return name.slice(0, 1);
}

export default async function SchedulePage() {
    // ── Step 1：驗證登入 ──────────────────────────────────────────────────
    const supabase = (await createClient()) as unknown as SupabaseClient<Database>;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // ── Step 2：取得 profile ───────────────────────────────────────────────
    const { data: myProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (!myProfile) {
        return (
            <div className="min-h-screen flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #ffdda9, #ffeed4)' }}>
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
                    <div className="text-4xl mb-3">⚠️</div>
                    <h2 className="text-lg font-bold text-gray-800 mb-2">Profile 尚未建立</h2>
                    <p className="text-sm text-gray-500">請聯絡店長建立你的員工資料。</p>
                    <p className="text-xs text-gray-400 font-mono bg-gray-50 rounded p-2 mt-3">{user.email}</p>
                    <form action={signOut} className="mt-5 inline-block">
                        <button
                            type="submit"
                            className="px-5 py-2 rounded-xl text-white text-sm font-bold"
                            style={{ background: 'linear-gradient(135deg, #654321, #8b5e3c)' }}
                        >
                            登出並返回登入
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    if (!myProfile.is_approved) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4"
                style={{ background: 'linear-gradient(135deg, #ffdda9, #ffeed4)' }}>
                <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 max-w-sm w-full text-center border-t-8 border-orange-400">
                    <div className="w-20 h-20 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl">
                        ⏳
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 mb-2">等待店長審核中</h2>
                    <div className="text-sm text-gray-600 mb-4 flex flex-col gap-1">
                        <span>您的帳號已建立，</span>
                        <span>但需要店長核准後才能檢視排班表，</span>
                        <span>請通知店長進行審核。</span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-xs text-left mb-6 space-y-1">
                        <div className="grid grid-cols-[60px_1fr]">
                            <span className="text-gray-400">姓名</span>
                            <span className="font-medium text-gray-700">{myProfile.full_name}</span>
                        </div>
                        <div className="grid grid-cols-[60px_1fr]">
                            <span className="text-gray-400">Email</span>
                            <span className="font-medium text-gray-700 truncate">{user.email}</span>
                        </div>
                        <div className="grid grid-cols-[60px_1fr]">
                            <span className="text-gray-400">申請時間</span>
                            <span className="font-medium text-gray-700">
                                {new Date(myProfile.created_at).toLocaleString('zh-TW')}
                            </span>
                        </div>
                    </div>
                    <form action={signOut} className="w-full">
                        <button
                            type="submit"
                            className="w-full py-3 rounded-xl text-white font-bold transition-transform active:scale-95 shadow-lg shadow-orange-200"
                            style={{ background: 'linear-gradient(135deg, #654321, #8b5e3c)' }}
                        >
                            登出並返回登入
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // ── Step 3：決定 activeStoreId（含多店 manager 邏輯）────────────────────
    const cookieStore = await cookies();
    let activeStoreId = myProfile.store_id;

    if (myProfile.role === 'manager') {
        // 查這個 manager 有幾間可管理的店
        const { data: managedStores } = await supabase
            .from('manager_stores')
            .select('store_id')
            .eq('manager_id', user.id);

        if ((managedStores?.length ?? 0) > 1) {
            // 多間店 → 必須從 cookie 取得選擇
            const selectedStoreId = cookieStore.get('selected_store_id')?.value;
            if (!selectedStoreId) {
                redirect('/select-store');
            }
            activeStoreId = selectedStoreId;
        }
    }

    // ── Step 4：取得店名 ───────────────────────────────────────────────────
    // 使用 admin client 確保不受 RLS 影響
    const admin = createServiceClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: storeData } = await admin
        .from('stores')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .select('name, auto_lock_scheduling' as any)
        .eq('id', activeStoreId)
        .single();

    const storeName = (storeData as any)?.name ?? '小木屋鬆餅';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const autoLockScheduling = (storeData as any)?.auto_lock_scheduling ?? true;

    // ── Step 5：取得同店所有員工 (包含管理這間店的其他店長) ───────────────
    // 1. 取得這間店原本的員工 (store_id = activeStoreId)
    const { data: primaryProfiles } = await admin
        .from('profiles')
        .select('*')
        .eq('store_id', activeStoreId);

    // 2. 取得管理這間店的所有管理者 ID
    const { data: storeManagers } = await admin
        .from('manager_stores')
        .select('manager_id')
        .eq('store_id', activeStoreId);

    const managerIds = (storeManagers ?? []).map(m => m.manager_id);

    // 3. 如果有其他管理者，也把它們的 profile 抓出來
    let additionalManagers: any[] = [];
    if (managerIds.length > 0) {
        const { data: managerProfiles } = await admin
            .from('profiles')
            .select('*')
            .in('id', managerIds)
            .neq('store_id', activeStoreId); // 排除原本就是這間店的人，避免重複

        if (managerProfiles) {
            additionalManagers = managerProfiles;
        }
    }

    // 合併並排序 (店長排在前面)
    const storeProfiles = [...(primaryProfiles ?? []), ...additionalManagers]
        .filter(p => p.is_approved) // 確保只有審核通過的人才會出現在班表和名冊
        .sort((a, b) => {
            if (a.role === 'manager' && b.role !== 'manager') return -1;
            if (a.role !== 'manager' && b.role === 'manager') return 1;
            return 0;
        });

    const allUsers: UserRecord[] = storeProfiles.map(p => ({
        id: p.id,
        name: p.full_name,
        role: p.role as 'manager' | 'staff',
        type: p.employment_type as 'fulltime' | 'parttime',
        avatar: initials(p.full_name),
        hourlyRate: p.hourly_rate,
    }));

    const currentUser = allUsers.find(u => u.id === user.id) ?? {
        id: user.id,
        name: myProfile.full_name,
        role: myProfile.role as 'manager' | 'staff',
        type: myProfile.employment_type as 'fulltime' | 'parttime',
        avatar: initials(myProfile.full_name),
        hourlyRate: myProfile.hourly_rate,
    };

    // ── Step 6：取得本月資料 ──────────────────────────────────────────────
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [year, month] = yearMonth.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const startDate = `${yearMonth}-01`;
    const endDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;

    const { data: dbShifts } = await supabase
        .from('shifts')
        .select('*')
        .eq('store_id', activeStoreId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date');

    const availQuery = supabase
        .from('availabilities')
        .select('*')
        .eq('store_id', activeStoreId)
        .gte('date', startDate)
        .lte('date', endDate);

    const { data: dbAvail } = myProfile.role === 'staff'
        ? await availQuery.eq('user_id', user.id)
        : await availQuery;

    const { data: monthlyConfig } = await supabase
        .from('monthly_configs')
        .select('closed_dates')
        .eq('store_id', activeStoreId)
        .eq('year_month', yearMonth)
        .maybeSingle();

    // ── Step 7：傳給 ScheduleClient ────────────────────────────────────────
    const initialShifts: ShiftRecord[] = (dbShifts ?? []).map(s => ({
        userId: s.user_id,
        date: s.date,
        assignedSlots: s.assigned_slots ?? [],
    }));

    const initialAvailability: AvailabilityRecord[] = (dbAvail ?? []).map(a => ({
        userId: a.user_id,
        date: a.date,
        type: a.type as 'available' | 'leave',
        slots: a.slots ?? [],
        leaveReason: a.leave_reason ?? undefined,
    }));

    const initialStoreClosed: string[] = monthlyConfig?.closed_dates ?? [];

    // 是否為多店 manager（決定是否顯示切換按鈕）
    const { data: managedStoresList } = await supabase
        .from('manager_stores')
        .select('store_id')
        .eq('manager_id', user.id);
    const isMultiStoreManager = (managedStoresList?.length ?? 0) > 1;

    // Fetch pending count for managers
    let pendingCount = 0;
    if (myProfile.role === 'manager') {
        const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('store_id', activeStoreId)
            .eq('is_approved', false);
        pendingCount = count ?? 0;
    }

    return (
        <ScheduleClient
            pendingCount={pendingCount}
            currentUser={currentUser}
            allUsers={allUsers}
            storeName={storeName}
            isMultiStoreManager={isMultiStoreManager}
            initialYearMonth={yearMonth}
            initialShifts={initialShifts}
            initialAvailability={initialAvailability}
            initialStoreClosed={initialStoreClosed}
            initialAutoLock={autoLockScheduling}
            storeId={activeStoreId}
        />
    );
}
