'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getPendingUsers, approveUser, rejectUser } from '@/lib/actions/admin';
import { X, Check, User, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface PendingUser {
    id: string;
    full_name: string;
    created_at: string;
    employment_type: string;
    avatar_url: string | null;
}

interface ManagerApprovalModalProps {
    isOpen: boolean;
    onClose: () => void;
    storeId: string;
    currentUserRole: string;
}

export function ManagerApprovalModal({ isOpen, onClose, storeId, currentUserRole }: ManagerApprovalModalProps) {
    const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        if (isOpen && currentUserRole === 'manager') {
            loadPendingUsers();
        }
    }, [isOpen, storeId]);

    async function loadPendingUsers() {
        setLoading(true);
        const res = await getPendingUsers(storeId);
        if (res.success && res.data) {
            setPendingUsers(res.data as PendingUser[]);
        }
        setLoading(false);
    }

    async function handleApprove(userId: string) {
        setProcessingId(userId);
        const res = await approveUser(userId);
        if (res.success) {
            setPendingUsers(prev => prev.filter(u => u.id !== userId));
            router.refresh(); // Refresh schedule page to potential updates
        } else {
            alert('核准失敗: ' + res.error);
        }
        setProcessingId(null);
    }

    async function handleReject(userId: string) {
        if (!confirm('確定要拒絕並刪除此申請嗎？無法復原。')) return;
        setProcessingId(userId);
        const res = await rejectUser(userId);
        if (res.success) {
            setPendingUsers(prev => prev.filter(u => u.id !== userId));
            router.refresh();
        } else {
            alert('拒絕失敗: ' + res.error);
        }
        setProcessingId(null);
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>

            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <User className="w-5 h-5 text-gray-600" />
                        員工加入審核
                        <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">
                            {pendingUsers.length} 待審核
                        </span>
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="text-center py-8 text-gray-400">載入中...</div>
                    ) : pendingUsers.length === 0 ? (
                        <div className="text-center py-10 flex flex-col items-center">
                            <Check className="w-12 h-12 text-emerald-100 mb-3" />
                            <p className="text-gray-500 font-medium">目前沒有待審核的申請</p>
                            <p className="text-xs text-gray-400 mt-1">新員工註冊後會出現在這裡</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {pendingUsers.map(user => (
                                <div key={user.id} className="flex items-center justify-between p-3 border rounded-xl hover:border-orange-200 hover:bg-orange-50/30 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shrink-0"
                                            style={{ background: 'linear-gradient(135deg, #654321, #8b5e3c)' }}>
                                            {user.full_name?.slice(0, 1) || '?'}
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-800">{user.full_name}</div>
                                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                                <span className={user.employment_type === 'fulltime' ? 'text-purple-600' : 'text-blue-600'}>
                                                    {user.employment_type === 'fulltime' ? '全職' : '工讀'}
                                                </span>
                                                <span>· {new Date(user.created_at).toLocaleDateString()} 申請</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleReject(user.id)}
                                            disabled={!!processingId}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                            title="拒絕並刪除"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleApprove(user.id)}
                                            disabled={!!processingId}
                                            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-lg shadow-sm transition-all flex items-center gap-1 disabled:opacity-50"
                                        >
                                            {processingId === user.id ? '...' : <><Check className="w-4 h-4" /> 核准</>}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-3 border-t bg-gray-50 text-xs text-center text-gray-400">
                    核准後員工即可登入並查看班表
                </div>
            </div>
        </div>
    );
}
