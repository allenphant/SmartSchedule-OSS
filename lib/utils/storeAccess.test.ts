import assert from 'node:assert/strict';
import test from 'node:test';

import { canManageStore, type StoreAccessClient } from './storeAccess.ts';

// 一個假的 supabase client：profiles 與 manager_stores 兩張表
function fakeClient(profiles: Record<string, { store_id: string; role: string }>, links: Array<[string, string]>): StoreAccessClient {
    return {
        from(table) {
            return {
                select() {
                    return {
                        eq(col1, v1) {
                            return {
                                async single() {
                                    const row = table === 'profiles' ? profiles[v1] : undefined;
                                    return { data: row ?? null };
                                },
                                eq(col2, v2) {
                                    return {
                                        async maybeSingle() {
                                            const hit = table === 'manager_stores'
                                                && links.some(([m, s]) => m === v1 && s === v2);
                                            return { data: hit ? { store_id: v2 } : null };
                                        },
                                    };
                                },
                            };
                        },
                    };
                },
            };
        },
    };
}

const profiles = {
    mgrA: { store_id: 'A', role: 'manager' },
    mgrAB: { store_id: 'A', role: 'manager' },
    staffA: { store_id: 'A', role: 'staff' },
};
const links: Array<[string, string]> = [['mgrAB', 'B']];
const client = fakeClient(profiles, links);

test('a manager manages their own store', async () => {
    assert.equal(await canManageStore(client, 'mgrA', 'A'), true);
});

test('a manager does not manage another store (the cross-store hole)', async () => {
    assert.equal(await canManageStore(client, 'mgrA', 'B'), false);
});

test('a manager of several stores manages each of them, and only them', async () => {
    assert.equal(await canManageStore(client, 'mgrAB', 'A'), true);
    assert.equal(await canManageStore(client, 'mgrAB', 'B'), true);
    assert.equal(await canManageStore(client, 'mgrAB', 'C'), false);
});

test('staff manage nothing, even their own store', async () => {
    assert.equal(await canManageStore(client, 'staffA', 'A'), false);
});

test('unknown users, empty ids and a missing store are refused', async () => {
    assert.equal(await canManageStore(client, 'ghost', 'A'), false);
    assert.equal(await canManageStore(client, '', 'A'), false);
    assert.equal(await canManageStore(client, 'mgrA', ''), false);
    assert.equal(await canManageStore(client, 'mgrA', undefined), false);
    assert.equal(await canManageStore(client, 'mgrA', null), false);
});
