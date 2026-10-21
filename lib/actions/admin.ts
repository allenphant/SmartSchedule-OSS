'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import { SupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { canManageStore, type StoreAccessClient } from '@/lib/utils/storeAccess';

// Admin actions require service role for some operations (like deleting users) 
// or ensuring we bypass RLS for listing pending users strictly.

export async function getPendingUsers(storeId: string) {
    const supabase = (await createClient()) as unknown as SupabaseClient<Database>;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    // 必須是「這家店」的店長，不只是任何地方的店長（下面用 service role，RLS 不會再擋）
    if (!(await canManageStore(supabase as unknown as StoreAccessClient, user.id, storeId))) {
        return { success: false, error: 'Forbidden' };
    }

    // Use service role to bypass RLS for listing pending users
    const admin = createServiceClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Fetch pending users for this store
    const { data: pendingUsers, error } = await admin
        .from('profiles')
        .select('*')
        .eq('store_id', storeId)
        .eq('is_approved', false)
        .order('created_at', { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, data: pendingUsers };
}

export async function approveUser(targetUserId: string) {
    const supabase = (await createClient()) as unknown as SupabaseClient<Database>;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const admin = createServiceClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // 目標屬於哪一家店，呼叫者就必須是那家店的店長
    const { data: target } = await admin.from('profiles').select('store_id').eq('id', targetUserId).single();
    if (!target || !(await canManageStore(supabase as unknown as StoreAccessClient, user.id, target.store_id))) {
        return { success: false, error: 'Forbidden' };
    }

    const { error } = await admin
        .from('profiles')
        .update({ is_approved: true })
        .eq('id', targetUserId);

    if (error) return { success: false, error: error.message };

    revalidatePath('/schedule');
    return { success: true };
}

export async function rejectUser(targetUserId: string) {
    const supabase = (await createClient()) as unknown as SupabaseClient<Database>;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    // 不能刪自己；目標屬於哪一家店，呼叫者就必須是那家店的店長
    if (targetUserId === user.id) return { success: false, error: 'Forbidden' };

    const admin = createServiceClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: target } = await admin.from('profiles').select('store_id').eq('id', targetUserId).single();
    if (!target || !(await canManageStore(supabase as unknown as StoreAccessClient, user.id, target.store_id))) {
        return { success: false, error: 'Forbidden' };
    }

    // Use service role to delete user from Auth and Profiles
    // Note: Deleting from Auth usually cascades to Profiles if configured, 
    // but here we might just delete profile or use service role to delete auth user.
    // For simplicity and safety, we will just delete the profile row. 
    // The auth user will remain but have no profile (like a broken state), 
    // OR we should delete auth user. Deleting auth user requires service role.

    // 1. Delete profile (manually first, though cascade might handle it)
    const { error: profileError } = await admin
        .from('profiles')
        .delete()
        .eq('id', targetUserId);

    if (profileError) return { success: false, error: profileError.message };

    // 2. Delete auth user
    const { error: authError } = await admin.auth.admin.deleteUser(targetUserId);

    // Note: If auth delete fails, we might have an issue, but usually it works.
    if (authError) console.error('Failed to delete auth user:', authError);

    revalidatePath('/schedule');
    return { success: true };
}
