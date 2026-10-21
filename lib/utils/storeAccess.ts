// ============================================
// 「這個人是不是這家店的店長」
//
// Server Action 用 service role 操作別人的資料時，RLS 不會幫忙擋，所以每個動作都要先
// 用這個函式確認：呼叫者是 manager，而且管理的是「目標資料所屬的那家店」。
// 只檢查 role === 'manager' 會讓 A 店店長動到 B 店的人與設定。
// ============================================

type Result = { data: Record<string, unknown> | null; error?: unknown };

/** supabase-js 用到的最小形狀，方便用假的 client 測試 */
export interface StoreAccessClient {
    from(table: string): {
        select(columns: string): {
            eq(column: string, value: string): {
                single(): PromiseLike<Result>;
                eq(column: string, value: string): { maybeSingle(): PromiseLike<Result> };
            };
        };
    };
}

/**
 * 用「呼叫者自己的 client」（RLS 生效）判斷：managerId 是 manager，且 storeId 是他的主店，
 * 或在 manager_stores 裡。任何錯誤、缺資料都當作沒有權限。
 */
export async function canManageStore(
    client: StoreAccessClient,
    managerId: string,
    storeId: string | null | undefined,
): Promise<boolean> {
    if (!managerId || !storeId) return false;

    const { data: profile } = await client
        .from('profiles').select('store_id, role').eq('id', managerId).single();
    if (!profile || profile.role !== 'manager') return false;
    if (profile.store_id === storeId) return true;

    const { data: link } = await client
        .from('manager_stores').select('store_id').eq('manager_id', managerId).eq('store_id', storeId).maybeSingle();
    return Boolean(link);
}
