// ============================================
// 排班相關 Server Actions
// ============================================
'use server';

import { createClient } from '@/lib/supabase/server';
import { createAuditLog } from './audit';
import type { Database, Shift } from '@/lib/types/database';
import { SupabaseClient } from '@supabase/supabase-js';

type ShiftInsert = Database['public']['Tables']['shifts']['Insert'];
type ShiftUpdate = Database['public']['Tables']['shifts']['Update'];

/**
 * Upsert 一個員工的班表（建立 or 更新 or 刪除）
 * Manager 使用：不需要知道 row 的 id
 * 如果 assignedSlots 是空陣列 → 刪除該 row
 */
export async function upsertShift(date: string, userId: string, assignedSlots: string[], storeId?: string) {
    const supabase = (await createClient()) as unknown as SupabaseClient<Database>;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Unauthorized' };

    // 取得 profile 決定預設 storeId 並確認角色
    const { data: profile } = await supabase
        .from('profiles').select('store_id, role').eq('id', user.id).single();

    if (!profile || profile.role !== 'manager') {
        return { success: false, error: 'Only managers can update shifts' };
    }

    // 使用傳入的 storeId 或 profile 的預設店
    const targetStoreId = storeId || profile.store_id;

    // 驗證是否有管理該分店的權限 (避免越權漏洞)
    const { data: hasAccess } = await supabase
        .from('manager_stores')
        .select('store_id')
        .eq('manager_id', user.id)
        .eq('store_id', targetStoreId)
        .maybeSingle();

    if (!hasAccess && targetStoreId !== profile.store_id) {
        return { success: false, error: 'Forbidden: You do not manage this store' };
    }

    // 空 slots → 刪除
    if (assignedSlots.length === 0) {
        const { error } = await supabase.from('shifts')
            .delete()
            .eq('store_id', targetStoreId)
            .eq('user_id', userId)
            .eq('date', date);
        if (error) return { success: false, error: error.message };
        return { success: true, data: null };
    }

    // 有 slots → upsert（依 store_id+user_id+date 衝突時更新）
    const { data: shift, error } = await supabase.from('shifts')
        .upsert(
            { store_id: targetStoreId, user_id: userId, date, assigned_slots: assignedSlots },
            { onConflict: 'store_id,user_id,date' }
        )
        .select().single();

    if (error) return { success: false, error: error.message };

    await createAuditLog({ action: 'UPSERT_SHIFT', details: { date, user_id: userId, slots: assignedSlots.length, store_id: targetStoreId } });
    return { success: true, data: shift };
}

/**
 * 建立新的班表
 */
export async function createShift(data: Omit<ShiftInsert, 'store_id'> & { store_id?: string }) {
    const supabase = (await createClient()) as unknown as SupabaseClient<Database>;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Unauthorized' };

    const { data: profile } = await supabase
        .from('profiles').select('store_id, role').eq('id', user.id).single();

    if (!profile || profile.role !== 'manager') {
        return { success: false, error: 'Only managers can create shifts' };
    }

    const targetStoreId = data.store_id || profile.store_id;

    // 驗證權限
    const { data: hasAccess } = await supabase
        .from('manager_stores')
        .select('store_id')
        .eq('manager_id', user.id)
        .eq('store_id', targetStoreId)
        .maybeSingle();

    if (!hasAccess && targetStoreId !== profile.store_id) {
        return { success: false, error: 'Forbidden' };
    }

    const { data: shift, error } = await supabase
        .from('shifts').insert({ ...data, store_id: targetStoreId }).select().single();

    if (error) return { success: false, error: error.message };

    await createAuditLog({ action: 'CREATE_SHIFT', details: { shift_id: shift.id, date: data.date, store_id: targetStoreId } });
    return { success: true, data: shift };
}

/**
 * 更新班表（by id）
 */
export async function updateShift(
    shiftId: number,
    updates: Partial<Omit<Shift, 'id' | 'created_at' | 'store_id' | 'user_id' | 'updated_at'>>
) {
    const supabase = (await createClient()) as unknown as SupabaseClient<Database>;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Unauthorized' };

    const { data: shift, error } = await supabase
        .from('shifts').update(updates as ShiftUpdate).eq('id', shiftId).select().single();

    if (error) return { success: false, error: error.message };

    await createAuditLog({ action: 'UPDATE_SHIFT', details: { shift_id: shiftId, updates } });
    return { success: true, data: shift };
}

/**
 * 刪除班表
 */
export async function deleteShift(shiftId: number) {
    const supabase = (await createClient()) as unknown as SupabaseClient<Database>;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Unauthorized' };

    const { error } = await supabase.from('shifts').delete().eq('id', shiftId);

    if (error) return { success: false, error: error.message };

    await createAuditLog({ action: 'DELETE_SHIFT', details: { shift_id: shiftId } });
    return { success: true };
}

/**
 * 取得指定月份的班表（含 profile join）
 */
export async function getMonthlyShifts(yearMonth: string, storeId?: string) {
    const supabase = (await createClient()) as unknown as SupabaseClient<Database>;

    const [year, month] = yearMonth.split('-');
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    const startDate = `${yearMonth}-01`;
    const endDate = `${yearMonth}-${lastDay}`;

    let query = supabase
        .from('shifts')
        .select(`*, profiles:user_id ( id, full_name, role, employment_type )`)
        .gte('date', startDate)
        .lte('date', endDate);

    if (storeId) {
        query = query.eq('store_id', storeId);
    }

    const { data, error } = await query.order('date');

    if (error) return { success: false, error: error.message, data: null };
    return { success: true, data };
}
