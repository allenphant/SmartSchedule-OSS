// ============================================
// 使用者註冊 Server Action
// ============================================
'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import { SupabaseClient } from '@supabase/supabase-js';

const STORES: Record<string, { id: string; name: string }> = {
    'zhonghe': { id: '00000000-0000-0000-0000-000000000001', name: '中和分店' },
    'xindian': { id: '00000000-0000-0000-0000-000000000002', name: '新店分店' },
};

// STORES 只在這個 server action 內部使用，不 export（'use server' 只能 export async functions）

export async function registerUser(formData: {
    email: string;
    password: string;
    fullName: string;
    storeKey: string;
    employmentType: 'fulltime' | 'parttime';
}) {
    const supabase = (await createClient()) as unknown as SupabaseClient<Database>;

    const store = STORES[formData.storeKey];
    if (!store) return { success: false, error: '請選擇正確的分店' };

    // 1. 建立 Auth 帳號
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
    });

    if (signUpError || !authData.user) {
        const msg = signUpError?.message ?? 'Registration failed';
        if (msg.includes('already registered')) return { success: false, error: '此 Email 已被註冊，請直接登入' };
        return { success: false, error: msg };
    }

    // 2. 建立 Profile（用 service role 繞過 RLS）
    const admin = createServiceClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const { error: profileError } = await admin.from('profiles').insert({
        id: authData.user.id,
        store_id: store.id,
        full_name: formData.fullName,
        role: 'staff',
        employment_type: formData.employmentType,
        hourly_rate: formData.employmentType === 'fulltime' ? 190 : 183,
        is_approved: false,
    });

    if (profileError) {
        return { success: false, error: `Profile 建立失敗：${profileError.message}` };
    }

    return { success: true, storeName: store.name };
}
