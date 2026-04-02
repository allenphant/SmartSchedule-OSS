'use server';

import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Database } from '@/lib/types/database';
import { SupabaseClient, createClient as createServiceClient } from '@supabase/supabase-js';

/**
 * 取得目前 manager 有權管理的所有分店
 */
export async function getManagerStores() {
    const supabase = (await createClient()) as unknown as SupabaseClient<Database>;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, data: [] as { store_id: string; store_name: string }[] };

    // manager_stores join stores
    const { data, error } = await supabase
        .from('manager_stores')
        .select('store_id')
        .eq('manager_id', user.id);

    if (error || !data) return { success: false, data: [] as { store_id: string; store_name: string }[] };

    // 取得各店名稱
    const storeIds = data.map(r => r.store_id);
    const { data: stores } = await supabase
        .from('stores')
        .select('id, name')
        .in('id', storeIds);

    const result = (stores ?? []).map(s => ({ store_id: s.id, store_name: s.name }));
    return { success: true, data: result };
}

/**
 * 選擇分店：寫入 cookie 後跳回 /schedule
 * 由 select-store 頁面的 form action 呼叫
 */
export async function selectStore(formData: FormData) {
    const storeId = formData.get('storeId') as string;
    if (!storeId) return;

    const cookieStore = await cookies();
    cookieStore.set('selected_store_id', storeId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7,  // 7天
        path: '/',
    });

    redirect('/schedule');
}

/**
 * 清除選擇的分店（讓 manager 回到選店畫面）
 */
export async function clearSelectedStore() {
    const cookieStore = await cookies();
    cookieStore.delete('selected_store_id');
    redirect('/select-store');
}

/**
 * 切換店面的自動鎖定排班設定
 */
export async function toggleAutoLockScheduling(storeId: string, newValue: boolean) {
    const supabase = (await createClient()) as unknown as SupabaseClient<Database>;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profile?.role !== 'manager') return { success: false, error: 'Forbidden' };

    const admin = createServiceClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await admin
        .from('stores')
        .update({ auto_lock_scheduling: newValue } as any)
        .eq('id', storeId);

    if (error) {
        console.error('Error updating auto_lock_scheduling:', error);
        return { success: false, error: error.message };
    }
    return { success: true };
}
