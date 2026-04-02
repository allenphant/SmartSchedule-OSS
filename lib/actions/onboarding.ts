'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import type { Database } from '@/lib/types/database';

export async function completeProfile(formData: FormData) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    const fullName = formData.get('fullName') as string;
    const storeId = formData.get('storeId') as string;
    const role = 'staff'; // Enforce staff role for new users
    const type = formData.get('type') as 'fulltime' | 'parttime';

    if (!storeId) {
        return { error: '請選擇分店' };
    }

    const admin = createServiceClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 2. Upsert Profile (bypass RLS to ensure creation if trigger failed)
    const { error: updateError } = await admin
        .from('profiles')
        .upsert({
            id: user.id,
            full_name: fullName,
            store_id: storeId,
            role: role,
            employment_type: type,
            is_approved: false, // Wait for manager approval
        });

    if (updateError) {
        return { error: '更新失敗，請稍後再試' };
    }

    // 3. Mark as Onboarded in Auth Metadata
    await supabase.auth.updateUser({
        data: { is_onboarded: true }
    });

    // 4. Redirect
    redirect('/schedule');
}
