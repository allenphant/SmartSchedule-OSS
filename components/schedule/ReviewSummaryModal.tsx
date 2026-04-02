'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, Calendar, MoveDown } from 'lucide-react';
import { AvailabilityRecord, ShiftRecord, UserRecord } from '@/components/ui/ShiftDetailModal';
import { getAvailabilitySummary, getShiftDetails } from '@/lib/utils/time';

interface ReviewSummaryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (period: number) => void;
    currentDate: Date;
    availability: AvailabilityRecord[];
    shifts: ShiftRecord[];
    storeClosed: string[];
    currentUser: UserRecord;
    confirmedPeriods: number[];
}

export function ReviewSummaryModal({
    isOpen,
    onClose,
    onConfirm,
    currentDate,
    availability = [],
    shifts = [],
    storeClosed = [],
    currentUser,
    confirmedPeriods = [],
}: ReviewSummaryModalProps) {
    const [period, setPeriod] = useState<1 | 2>(1);
    const [showScrollHint, setShowScrollHint] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Calculate dates and logic REGARDLESS of isOpen to keep hooks stable
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const { records, unfilledCount } = useMemo(() => {
        const result = [];
        let count = 0;
        
        const startDay = period === 1 ? 1 : 16;
        const endDay = period === 1 ? 15 : daysInMonth;

        for (let day = startDay; day <= endDay; day++) {
            const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            const isClosed = storeClosed.includes(dateStr);
            
            // Safe access to availability and shifts
            const myAvail = (availability || []).find(a => a.userId === currentUser?.id && a.date === dateStr);
            const myShift = (shifts || []).find(s => s.userId === currentUser?.id && s.date === dateStr);
            
            const isUnregistered = !isClosed && (
                !myAvail || 
                (myAvail.type === 'available' && (!myAvail.slots || myAvail.slots.length === 0))
            );
            
            if (isUnregistered) count++;

            result.push({
                day,
                dateStr,
                isClosed,
                myAvail,
                myShift,
                isUnregistered
            });
        }
        return { records: result, unfilledCount: count };
    }, [period, year, month, daysInMonth, storeClosed, availability, shifts, currentUser?.id]);

    const isConfirmed = confirmedPeriods.includes(period);

    // Handle scroll check logic
    const checkScroll = () => {
        if (scrollContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
            // 如果還沒滑到底 (留 5px 緩衝)，且內容確實比容器大，就顯示提示
            const isAtBottom = scrollHeight - scrollTop <= clientHeight + 5;
            const hasMoreToScroll = scrollHeight > clientHeight;
            setShowScrollHint(!isAtBottom && hasMoreToScroll);
        }
    };

    // Check scroll on open and when dependencies change
    useEffect(() => {
        if (isOpen) {
            // 用 setTimeout 確保 DOM 已經渲染並取得正確高度
            const timer = setTimeout(checkScroll, 150);
            return () => clearTimeout(timer);
        }
    }, [isOpen, period, records.length]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="p-4 md:p-6 border-b flex justify-between items-center bg-gradient-to-r from-slate-50 to-white">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Calendar className="w-6 h-6 text-blue-600" />
                            {year}年{month + 1}月 登記情形統整
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">請確認您的出勤意願與已排班表</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-slate-50/30 relative">
                    {/* Period Selector */}
                    <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                        <button
                            onClick={() => setPeriod(1)}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${period === 1 ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            上半月 (1~15號)
                        </button>
                        <button
                            onClick={() => setPeriod(2)}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${period === 2 ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            下半月 (16號~月底)
                        </button>
                    </div>

                    {/* Status Summary Cards */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${unfilledCount > 0 ? 'bg-orange-50 border-orange-200' : 'bg-emerald-50 border-emerald-200'}`}>
                            <span className={`text-2xl font-black ${unfilledCount > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
                                {unfilledCount}
                            </span>
                            <span className="text-xs font-bold text-slate-500 mt-1">未登記天數</span>
                        </div>
                        <div className="p-4 rounded-xl border-2 bg-blue-50 border-blue-200 flex flex-col items-center justify-center">
                            <span className="text-2xl font-black text-blue-600">
                                {records.filter(r => r.myShift).length}
                            </span>
                            <span className="text-xs font-bold text-slate-500 mt-1">已排班天數</span>
                        </div>
                    </div>

                    {unfilledCount > 0 ? (
                        <div className="flex items-center gap-2 p-3 bg-amber-100 border border-amber-200 rounded-lg text-amber-800 text-sm font-bold animate-pulse">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <span>尚有 {unfilledCount} 天未登記，請務必點擊補齊！</span>
                        </div>
                    ) : isConfirmed ? (
                        <div className="flex items-center gap-2 p-3 bg-emerald-100 border border-emerald-200 rounded-lg text-emerald-800 text-sm font-bold">
                            <CheckCircle2 className="w-5 h-5 shrink-0" />
                            <span>本時段已確認登記完成！</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 p-3 bg-blue-100 border border-blue-200 rounded-lg text-blue-800 text-sm font-bold">
                            <CheckCircle2 className="w-5 h-5 shrink-0" />
                            <span>本時段資料已填寫齊全，請點擊下方確認按鈕。</span>
                        </div>
                    )}

                    {/* Records List */}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm relative flex flex-col">
                        <div className="grid grid-cols-7 bg-slate-100 border-b border-slate-200 text-[10px] md:text-xs font-bold text-slate-500 text-center py-2 sticky top-0 z-10">
                            <div>日期</div>
                            <div className="col-span-3">我的意願 / 備註</div>
                            <div className="col-span-3">最終班表</div>
                        </div>
                        <div 
                            ref={scrollContainerRef}
                            onScroll={checkScroll}
                            className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto"
                        >
                            {records.map((r) => (
                                <div key={r.dateStr} className={`grid grid-cols-7 text-xs md:text-sm py-3 px-1 items-center transition-colors ${r.isUnregistered ? 'bg-orange-50/50' : r.isClosed ? 'bg-slate-50 opacity-60' : 'hover:bg-slate-50'}`}>
                                    <div className="text-center font-bold text-slate-600">
                                        {r.day}
                                        <span className="text-[10px] block opacity-50 font-normal">
                                            {['日', '一', '二', '三', '四', '五', '六'][new Date(r.dateStr).getDay()]}
                                        </span>
                                    </div>
                                    
                                    <div className="col-span-3 px-2">
                                        {r.isClosed ? (
                                            <span className="text-slate-400 italic">店休</span>
                                        ) : r.myAvail ? (
                                            <div className="flex flex-col">
                                                <span className={`font-bold ${r.myAvail.type === 'available' ? 'text-emerald-600' : 'text-red-500'}`}>
                                                    {r.myAvail.type === 'available' ? '可上班' : '休假'}
                                                </span>
                                                {r.myAvail.type === 'available' && (
                                                    <span className="text-[10px] text-slate-500 truncate">
                                                        {getAvailabilitySummary(r.myAvail.slots)}
                                                    </span>
                                                )}
                                                {r.myAvail.leaveReason && (
                                                    <span className="text-[10px] text-slate-400 truncate">💬 {r.myAvail.leaveReason}</span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-orange-500 font-bold flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3" /> 未登記
                                            </span>
                                        )}
                                    </div>

                                    <div className="col-span-3 px-2">
                                        {r.myShift ? (
                                            <div className="flex flex-col items-center md:items-start">
                                                <span className="bg-blue-600 text-white text-[10px] md:text-xs px-2 py-0.5 rounded font-bold shadow-sm">
                                                    {getShiftDetails(r.myShift.assignedSlots)?.range}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-300 text-[10px]">尚未排班</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Scroll Hint - Conditionally rendered */}
                        {showScrollHint && (
                            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none flex items-end justify-center pb-1">
                                <MoveDown className="w-4 h-4 text-slate-300 animate-bounce" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-slate-50 flex justify-between items-center gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 text-slate-600 hover:text-slate-800 font-bold rounded-xl transition-all"
                    >
                        繼續填寫
                    </button>
                    <button
                        onClick={() => onConfirm(period)}
                        disabled={unfilledCount > 0 || isConfirmed}
                        className={`px-6 py-2.5 font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2 ${
                            unfilledCount > 0 || isConfirmed
                                ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                    >
                        <CheckCircle2 className="w-5 h-5" />
                        {isConfirmed ? '已確認登記完成' : '我已確認登記完成'}
                    </button>
                </div>
            </div>
        </div>
    );
}
