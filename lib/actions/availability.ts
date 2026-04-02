// ============================================
// 空閒時間相關 Server Actions
// ============================================
'use server';

import { createClient } from '@/lib/supabase/server';
import { createAuditLog } from './audit';
import type { Database } from '@/lib/types/database';
import { SupabaseClient } from '@supabase/supabase-js';

type AvailabilityInsert = Database['public']['Tables']['availabilities']['Insert'];

/**
 * 建立或更新空閒時間（使用 upsert）
 */
export async function upsertAvailability(data: Omit<AvailabilityInsert, 'store_id' | 'user_id'>) {
    const supabase = (await createClient()) as unknown as SupabaseClient<Database>;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: 'Unauthorized' };
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('store_id')
        .eq('id', user.id)
        .single();

    if (!profile) {
        return { success: false, error: 'Profile not found' };
    }

    const availabilityData: AvailabilityInsert = {
        ...data,
        store_id: profile.store_id,
        user_id: user.id,
    };

    const { data: availability, error } = await supabase
        .from('availabilities')
        .upsert(
            availabilityData,
            {
                onConflict: 'store_id,user_id,date',
            }
        )
        .select()
        .single();

    if (error) {
        return { success: false, error: error.message };
    }

    await createAuditLog({
        action: 'CREATE_AVAILABILITY',
        details: { date: data.date, type: data.type },
    });

    return { success: true, data: availability };
}

/**
 * 刪除空閒時間
 */
export async function deleteAvailability(date: string) {
    const supabase = (await createClient()) as unknown as SupabaseClient<Database>;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: 'Unauthorized' };
    }

    const { error } = await supabase
        .from('availabilities')
        .delete()
        .eq('user_id', user.id)
        .eq('date', date);

    if (error) {
        return { success: false, error: error.message };
    }

    await createAuditLog({
        action: 'DELETE_AVAILABILITY',
        details: { date },
    });

    return { success: true };
}

/**
 * 取得指定月份的所有空閒時間（Manager 使用）
 */
export async function getMonthlyAvailabilities(yearMonth: string, storeId?: string) {
    const supabase = (await createClient()) as unknown as SupabaseClient<Database>;

    const [year, month] = yearMonth.split('-');
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    const startDate = `${yearMonth}-01`;
    const endDate = `${yearMonth}-${lastDay}`;

    let query = supabase
        .from('availabilities')
        .select(
            `
      *,
      profiles:user_id (
        id,
        full_name,
        employment_type
      )
    `
        )
        .gte('date', startDate)
        .lte('date', endDate);

    if (storeId) {
        query = query.eq('store_id', storeId);
    }

    const { data, error } = await query.order('date');

    if (error) {
        return { success: false, error: error.message, data: null };
    }

    return { success: true, data };
}

/**
 * 取得自己的空閒時間
 */
export async function getMyAvailabilities(yearMonth: string) {
    const supabase = (await createClient()) as unknown as SupabaseClient<Database>;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: 'Unauthorized', data: null };
    }

    const [year, month] = yearMonth.split('-');
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    const startDate = `${yearMonth}-01`;
    const endDate = `${yearMonth}-${lastDay}`;

    const { data, error } = await supabase
        .from('availabilities')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date');

    if (error) {
        return { success: false, error: error.message, data: null };
    }

    return { success: true, data };
}

/**
 * 取得自己的登記確認狀態
 */
export async function getMyConfirmations(yearMonth: string) {
    const supabase = (await createClient()) as unknown as SupabaseClient<Database>;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: 'Unauthorized', data: null };
    }

    const { data, error } = await supabase
        .from('registration_confirmations')
        .select('*')
        .eq('user_id', user.id)
        .eq('year_month', yearMonth);

    if (error) {
        return { success: false, error: error.message, data: null };
    }

    return { success: true, data };
}

/**
 * 確認登記完成
 */
export async function confirmRegistration(yearMonth: string, period: number) {
    const supabase = (await createClient()) as unknown as SupabaseClient<Database>;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: 'Unauthorized' };
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('store_id')
        .eq('id', user.id)
        .single();

    if (!profile) {
        return { success: false, error: 'Profile not found' };
    }

    const { error } = await supabase
        .from('registration_confirmations')
        .upsert({
            user_id: user.id,
            store_id: profile.store_id,
            year_month: yearMonth,
            period: period,
            confirmed_at: new Date().toISOString()
        }, {
            onConflict: 'user_id,store_id,year_month,period'
        });

    if (error) {
        return { success: false, error: error.message };
    }

    await createAuditLog({
        action: 'CONFIRM_REGISTRATION',
        details: { yearMonth, period },
    });

    return { success: true };
}
