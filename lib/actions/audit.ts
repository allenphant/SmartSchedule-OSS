'use server';

import { createClient } from '@/lib/supabase/server';
import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/types/database';

export type AuditAction =
    | 'CREATE_SHIFT'
    | 'UPDATE_SHIFT'
    | 'UPSERT_SHIFT'
    | 'DELETE_SHIFT'
    | 'CREATE_AVAILABILITY'
    | 'UPDATE_AVAILABILITY'
    | 'DELETE_AVAILABILITY'
    | 'UPDATE_PROFILE'
    | 'CREATE_TEMPLATE'
    | 'UPDATE_MONTHLY_CONFIG'
    | 'UPDATE_CLOSED_DATES'
    | 'PUBLISH_SCHEDULE'
    | 'LOCK_SCHEDULE'
    | 'CONFIRM_REGISTRATION';

interface CreateAuditLogParams {
    action: AuditAction;
    details?: Json;
}

/**
 * 建立稽核日誌
 * Server Action，自動記錄當前使用者與 store_id
 */
export async function createAuditLog({ action, details = {} }: CreateAuditLogParams) {
    const supabase = (await createClient()) as unknown as SupabaseClient<Database>;

    // 取得當前使用者
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        console.error('[AuditLog] Auth error:', authError);
        return { success: false, error: 'Unauthorized' };
    }

    // 取得使用者的 store_id
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('store_id')
        .eq('id', user.id)
        .single();

    if (profileError || !profile) {
        console.error('[AuditLog] Profile error:', profileError);
        return { success: false, error: 'Profile not found' };
    }

    // 寫入 audit log
    const { error: insertError } = await supabase.from('audit_logs').insert({
        store_id: profile.store_id,
        user_id: user.id,
        action,
        details,
    });

    if (insertError) {
        console.error('[AuditLog] Insert error:', insertError);
        return { success: false, error: insertError.message };
    }

    return { success: true };
}

/**
 * 取得 audit logs (僅 Manager 可用)
 */
export async function getAuditLogs(limit: number = 50) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('audit_logs')
        .select(
            `
      *,
      profiles:user_id (full_name, role)
    `
        )
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('[AuditLog] Fetch error:', error);
        return { success: false, error: error.message, data: null };
    }

    return { success: true, data };
}
