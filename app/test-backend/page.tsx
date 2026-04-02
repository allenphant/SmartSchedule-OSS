'use client';

import { useState } from 'react';
import { getAuditLogs } from '@/lib/actions/audit';
import { getMonthlyAvailabilities, getMyAvailabilities, upsertAvailability } from '@/lib/actions/availability';
import { getMonthlyShifts, createShift } from '@/lib/actions/shifts';

export default function TestBackendPage() {
    const [result, setResult] = useState<unknown>(null);
    const [loading, setLoading] = useState(false);

    const handleAction = async (actionFn: () => Promise<unknown>) => {
        setLoading(true);
        try {
            const data = await actionFn();
            setResult(data);
        } catch (error) {
            setResult({ error: String(error) });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8">
            <h1 className="text-2xl font-bold">Backend Verification</h1>

            <div className="flex gap-4 flex-wrap">
                {/* Audit Logs */}
                <div className="space-y-2 border p-4 rounded">
                    <h2 className="font-semibold">Audit Logs</h2>
                    <button
                        onClick={() => handleAction(() => getAuditLogs())}
                        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
                        disabled={loading}
                    >
                        Get Audit Logs
                    </button>
                </div>

                {/* Availability */}
                <div className="space-y-2 border p-4 rounded">
                    <h2 className="font-semibold">Availability</h2>
                    <button
                        onClick={() => handleAction(() => getMonthlyAvailabilities('2026-02'))}
                        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50 mr-2"
                        disabled={loading}
                    >
                        Get Monthly (2026-02)
                    </button>
                    <button
                        onClick={() => handleAction(() => getMyAvailabilities('2026-02'))}
                        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50 mr-2"
                        disabled={loading}
                    >
                        Get My (2026-02)
                    </button>
                    <button
                        onClick={() => handleAction(() => upsertAvailability({
                            date: '2026-02-15',
                            slots: ['09:00', '10:00'],
                            type: 'available'
                        }))}
                        className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800 disabled:opacity-50"
                        disabled={loading}
                    >
                        Upsert Test (Available)
                    </button>
                </div>

                {/* Shifts */}
                <div className="space-y-2 border p-4 rounded">
                    <h2 className="font-semibold">Shifts</h2>
                    <button
                        onClick={() => handleAction(() => getMonthlyShifts('2026-02'))}
                        className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:opacity-50 mr-2"
                        disabled={loading}
                    >
                        Get Monthly Shifts
                    </button>
                </div>
            </div>

            <div className="border p-4 rounded bg-black min-h-[300px]">
                <h2 className="font-semibold mb-2 text-white">Result:</h2>
                {loading ? (
                    <p className="text-gray-400">Loading...</p>
                ) : (
                    <pre className="whitespace-pre-wrap text-sm overflow-auto max-h-[500px] text-gray-200">
                        {result ? JSON.stringify(result, null, 2) : 'No result'}
                    </pre>
                )}
            </div>
        </div>
    );
}
