// ============================================
// 月份設定相關 Server Actions (店休日 / 月份狀態)
// ============================================
'use server';

import { createClient } from '@/lib/supabase/server';
import { createAuditLog } from './audit';
import type { Database } from '@/lib/types/database';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * 取得指定月份設定（店休日、月份狀態）
 * 若尚未建立 → 回傳 null（前端當成 draft + 無店休）
 */
export async function getMonthlyConfig(yearMonth: string) {
    const supabase = (await createClient()) as unknown as SupabaseClient<Database>;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized', data: null };

    const { data: profile } = await supabase
        .from('profiles').select('store_id').eq('id', user.id).single();
    if (!profile) return { success: false, error: 'Profile not found', data: null };

    const { data, error } = await supabase
        .from('monthly_configs')
        .select('*')
        .eq('store_id', profile.store_id)
        .eq('year_month', yearMonth)
        .maybeSingle(); // 若不存在也不報錯

    if (error) return { success: false, error: error.message, data: null };
    return { success: true, data }; // data 可能是 null（代表沒建過）
}

/**
 * 更新（或建立）指定月份的店休日清單
 * Manager 使用
 */
export async function upsertClosedDates(yearMonth: string, closedDates: string[]) {
    const supabase = (await createClient()) as unknown as SupabaseClient<Database>;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const { data: profile } = await supabase
        .from('profiles').select('store_id, role').eq('id', user.id).single();

    if (!profile || profile.role !== 'manager') {
        return { success: false, error: 'Only managers can update store closed dates' };
    }

    const { data, error } = await supabase
        .from('monthly_configs')
        .upsert(
            { store_id: profile.store_id, year_month: yearMonth, closed_dates: closedDates },
            { onConflict: 'store_id,year_month' }
        )
        .select().single();

    if (error) return { success: false, error: error.message };

    await createAuditLog({
        action: 'UPDATE_CLOSED_DATES',
        details: { year_month: yearMonth, closed_dates: closedDates },
    });

    return { success: true, data };
}
