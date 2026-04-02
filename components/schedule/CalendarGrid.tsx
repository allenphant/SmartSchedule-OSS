'use client';

import { ChevronLeft, ChevronRight, Lock, CalendarDays, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
import { getAvailabilitySummary, getShiftDetails, calculateBillableHours } from '@/lib/utils/time';

interface CalendarGridProps {
    currentDate: Date;
    onDateChange: (date: Date) => void;
    onDateClick: (dateStr: string) => void;
    shifts: any[];
    availability: any[];
    storeClosed: string[];
    currentUser: any;
    nationalHolidays?: string[];
    warningText?: string | null;
}

// Long-press button using native DOM events (React synthetic events cancel intervals)
function LongPressNavButton({
    onClick,
    children,
    className,
}: {
    onClick: () => void;
    children: React.ReactNode;
    className?: string;
}) {
    const btnRef = useRef<HTMLButtonElement>(null);
    // Store callback in ref so the interval always calls the latest version
    const onClickRef = useRef(onClick);
    useEffect(() => { onClickRef.current = onClick; }, [onClick]);

    useEffect(() => {
        const btn = btnRef.current;
        if (!btn) return;

        let delayTimer: ReturnType<typeof setTimeout> | null = null;
        let repeatTimer: ReturnType<typeof setInterval> | null = null;

        const stop = () => {
            if (delayTimer) { clearTimeout(delayTimer); delayTimer = null; }
            if (repeatTimer) { clearInterval(repeatTimer); repeatTimer = null; }
        };

        const start = (e: MouseEvent | TouchEvent) => {
            e.preventDefault();
            onClickRef.current();
            delayTimer = setTimeout(() => {
                repeatTimer = setInterval(() => onClickRef.current(), 200);
            }, 500);
        };

        btn.addEventListener('mousedown', start);
        btn.addEventListener('touchstart', start, { passive: false });
        btn.addEventListener('mouseup', stop);
        btn.addEventListener('mouseleave', stop);
        btn.addEventListener('touchend', stop);
        btn.addEventListener('touchcancel', stop);

        return () => {
            stop();
            btn.removeEventListener('mousedown', start);
            btn.removeEventListener('touchstart', start);
            btn.removeEventListener('mouseup', stop);
            btn.removeEventListener('mouseleave', stop);
            btn.removeEventListener('touchend', stop);
            btn.removeEventListener('touchcancel', stop);
        };
    }, []); // empty deps — stable via ref

    return (
        <button ref={btnRef} className={className}>
            {children}
        </button>
    );
}


export function CalendarGrid({
    currentDate,
    onDateChange,
    onDateClick,
    shifts,
    availability,
    storeClosed,
    currentUser,
    nationalHolidays = [],
    warningText,
}: CalendarGridProps) {
    const today = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const [showYearPicker, setShowYearPicker] = useState(false);
    const yearPickerRef = useRef<HTMLDivElement>(null);

    // Close year picker when clicking outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (yearPickerRef.current && !yearPickerRef.current.contains(e.target as Node)) {
                setShowYearPicker(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const minYear = today.getFullYear() - 3;
    const maxYear = today.getFullYear() + 1;
    const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);

    const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
    const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();
    const getWeekdayShort = (d: number) => ['日', '一', '二', '三', '四', '五', '六'][d];
    const getDateString = (day: number) =>
        `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const prevMonthDays = getDaysInMonth(year, month - 1);

    const goToPrev = () => onDateChange(new Date(year, month - 1, 1));
    const goToNext = () => onDateChange(new Date(year, month + 1, 1));
    const goToToday = () => onDateChange(new Date(today.getFullYear(), today.getMonth(), 1));

    const cells: React.ReactNode[] = [];

    // Prev month fillers
    for (let i = firstDay - 1; i >= 0; i--) {
        cells.push(
            <div key={`prev-${i}`} className="min-h-[90px] bg-gray-50/50 border border-gray-100" />
        );
    }

    // Current month cells
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = getDateString(day);
        const closed = storeClosed.includes(dateStr);
        const isNationalHoliday = nationalHolidays.includes(dateStr);
        const dow = new Date(year, month, day).getDay();
        const isWeekend = dow === 0 || dow === 6;
        const isRedDate = isNationalHoliday || isWeekend;
        const isToday = today.toDateString() === new Date(year, month, day).toDateString();

        const dayShifts = shifts.filter(s => s.date === dateStr);
        const myShift = dayShifts.find(s => s.userId === currentUser.id);
        const myAvail = availability.find(a => a.userId === currentUser.id && a.date === dateStr);
        const totalAvailable = availability.filter(a => a.date === dateStr && a.type === 'available').length;
        const totalLeave = availability.filter(a => a.date === dateStr && a.type === 'leave').length;

        // Store stats for manager view
        const ftHours = dayShifts
            .filter((s: any) => s._userType === 'fulltime')
            .reduce((a: number, s: any) => a + calculateBillableHours(s.assignedSlots?.length ?? 0).billable, 0);
        const ptHours = dayShifts
            .filter((s: any) => s._userType === 'parttime')
            .reduce((a: number, s: any) => a + calculateBillableHours(s.assignedSlots?.length ?? 0).billable, 0);
        const totalHours = dayShifts.reduce((a: number, s: any) => a + calculateBillableHours(s.assignedSlots?.length ?? 0).billable, 0);
        const isWeekendDay = dow === 0 || dow === 6;
        const target = isWeekendDay ? { min: 28, max: 32 } : { min: 24, max: 28 };
        const storeStatus = totalHours > 0 && totalHours < target.min ? 'low' : totalHours > target.max ? 'high' : 'ok';

        let baseClass = 'min-h-[90px] border border-gray-100 p-2 transition-all relative flex flex-col justify-between cursor-pointer ';
        let cellContent: React.ReactNode = null;

        if (closed) {
            baseClass += 'bg-gray-100 hover:bg-gray-200';
            cellContent = (
                <div className="flex-1 flex flex-col items-center justify-center opacity-40">
                    <Lock className="w-4 h-4 mb-1" />
                    <span className="text-xs font-bold text-gray-500">店休</span>
                </div>
            );
        } else if (currentUser.role === 'manager') {
            baseClass += isToday ? 'bg-blue-50 hover:bg-blue-100' : 'bg-white hover:bg-blue-50';
            cellContent = (
                <div className="mt-1 space-y-1">
                    <div className="flex gap-1 text-[10px] flex-wrap">
                        <span className="text-emerald-600 bg-emerald-50 px-1 rounded flex items-center gap-0.5 border border-emerald-100">
                            <CheckCircle className="w-2.5 h-2.5" /> {totalAvailable}
                        </span>
                        <span className="text-red-500 bg-red-50 px-1 rounded flex items-center gap-0.5 border border-red-100">
                            <XCircle className="w-2.5 h-2.5" /> {totalLeave}
                        </span>
                    </div>
                    {dayShifts.length > 0 && (
                        <div className="space-y-0.5">
                            <div className="flex gap-1 text-[9px]">
                                <div className="flex-1 bg-indigo-50 text-indigo-700 px-1 py-0.5 rounded border border-indigo-100 text-center">FT:{ftHours}</div>
                                <div className="flex-1 bg-orange-50 text-orange-700 px-1 py-0.5 rounded border border-orange-100 text-center">PT:{ptHours}</div>
                            </div>
                            {storeStatus !== 'ok' && (
                                <div className={`text-[9px] font-bold text-center ${storeStatus === 'low' ? 'text-red-500' : 'text-amber-500'}`}>
                                    {storeStatus === 'low' ? '▼ 時數過低' : '▲ 時數過高'}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            );
        } else {
            // Staff view
            const todayDate = today.getDate();
            const todayMonth = today.getMonth();
            const todayYear = today.getFullYear();
            
            const cellDate = new Date(year, month, day);
            const cellMonth = cellDate.getMonth();
            const cellYear = cellDate.getFullYear();

            // 定義「下一期」範圍
            let isNextPeriod = false;
            if (todayDate <= 15) {
                // 今天是上半月，下一期是本月下半月 (16~月底)
                isNextPeriod = cellYear === todayYear && cellMonth === todayMonth && day >= 16;
            } else {
                // 今天是下半月，下一期是下個月上半月 (1~15)
                const nextMonthDate = new Date(todayYear, todayMonth + 1, 1);
                isNextPeriod = cellYear === nextMonthDate.getFullYear() && cellMonth === nextMonthDate.getMonth() && day <= 15;
            }

            const isUnregistered = !myAvail && !closed && isNextPeriod;

            if (myShift) {
                baseClass += 'bg-blue-50 ring-2 ring-blue-500 ring-inset hover:bg-blue-100';
            } else if (myAvail?.type === 'leave') {
                baseClass += 'bg-red-50 hover:bg-red-100';
            } else if (myAvail?.type === 'available') {
                baseClass += 'bg-emerald-50 hover:bg-emerald-100';
            } else if (isUnregistered) {
                baseClass += 'bg-orange-50 border-orange-200 hover:bg-orange-100 animate-pulse-subtle';
            } else {
                baseClass += isToday ? 'bg-blue-50 hover:bg-blue-100' : 'bg-white hover:bg-gray-50';
            }

            if (myShift) {
                const details = getShiftDetails(myShift.assignedSlots);
                if (details) {
                    cellContent = (
                        <div className="mt-auto flex flex-col gap-0.5">
                            <div className="bg-blue-500 text-white text-[10px] py-1 px-2 rounded font-bold text-center shadow-sm truncate">
                                {details.range}
                            </div>
                            <div className="text-[9px] text-blue-600 text-center font-bold">({details.hours}h)</div>
                        </div>
                    );
                }
            } else if (myAvail?.type === 'leave') {
                cellContent = (
                    <div className="mt-auto bg-red-100 text-red-600 text-[10px] py-1 px-2 rounded font-bold text-center">
                        休假 🏖️
                    </div>
                );
            } else if (myAvail?.type === 'available') {
                cellContent = (
                    <div className="mt-auto">
                        <div className="text-emerald-600 text-[10px] font-bold mb-0.5">{(myAvail.slots?.length ?? 0) * 0.5} hr</div>
                        <div className="bg-emerald-100 text-emerald-700 text-[10px] py-1 px-2 rounded font-bold text-center border border-emerald-200 truncate">
                            {getAvailabilitySummary(myAvail.slots)}
                        </div>
                    </div>
                );
            } else if (isUnregistered) {
                cellContent = (
                    <div className="mt-auto flex flex-col items-center gap-1">
                        <span className="text-orange-500 text-[10px] font-bold animate-bounce">⚠️ 未登記</span>
                        <div className="text-orange-400 text-[9px] text-center border border-orange-200 rounded px-1 py-0.5 bg-white/50">點擊補填</div>
                    </div>
                );
            } else {
                cellContent = <div className="mt-auto text-gray-300 text-[10px] text-center">點擊填寫</div>;
            }
        }

        cells.push(
            <div key={dateStr} className={baseClass} onClick={() => onDateClick(dateStr)}>
                <div className="flex justify-between items-start">
                    <span className={[
                        'text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full shrink-0',
                        isToday ? 'bg-blue-600 text-white' : (isRedDate ? 'text-red-500' : 'text-gray-700'),
                    ].join(' ')}>
                        {day}
                    </span>
                    {isNationalHoliday && <span className="w-2 h-2 rounded-full bg-red-500 mt-1 shrink-0" title="國定假日" />}
                </div>
                {cellContent}
            </div>
        );
    }

    // Next month fillers
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
        cells.push(<div key={`next-${i}`} className="min-h-[90px] bg-gray-50/50 border border-gray-100" />);
    }

    return (
        <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 flex items-center gap-2 border-b border-gray-200 shrink-0">
                {/* Nav pill: prev + year + month + next + TODAY */}
                <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl shadow-sm px-1 py-1">
                    <LongPressNavButton
                        onClick={goToPrev}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600 active:bg-gray-200 select-none"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </LongPressNavButton>

                    {/* Year picker */}
                    <div className="relative" ref={yearPickerRef}>
                        <button
                            onClick={() => setShowYearPicker(v => !v)}
                            className="flex items-center font-bold text-lg text-slate-800 hover:text-blue-600 transition-colors px-1 py-0.5 rounded"
                        >
                            {year}
                        </button>
                        {showYearPicker && (
                            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl z-[100] overflow-hidden min-w-[80px]">
                                {years.map(y => (
                                    <button
                                        key={y}
                                        onClick={() => { onDateChange(new Date(y, month, 1)); setShowYearPicker(false); }}
                                        className={[
                                            'w-full text-left px-4 py-2 text-sm font-bold transition-colors',
                                            y === year ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50',
                                        ].join(' ')}
                                    >
                                        {y}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <span className="font-bold text-lg text-slate-800 px-0.5">{month + 1}月</span>

                    <LongPressNavButton
                        onClick={goToNext}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600 active:bg-gray-200 select-none"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </LongPressNavButton>

                    {/* Today button — inside the nav pill, right of > */}
                    <div className="w-px h-5 bg-gray-200 mx-1" />
                    <button
                        onClick={goToToday}
                        className="flex items-center gap-1 px-2.5 py-1 text-sm font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                        <CalendarDays className="w-4 h-4" />
                        今天
                    </button>
                </div>

                {/* Warning Text (to the right of navigation) */}
                {warningText && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-red-50 border border-red-100 rounded-full animate-pulse-subtle ml-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                        <span className="text-xs md:text-sm font-black text-red-600 whitespace-nowrap">
                            尚未完成 {warningText} 登記作業！
                        </span>
                    </div>
                )}
            </div>

            {/* Scrollable Container for Table */}
            <div className="flex-1 overflow-auto relative">
                <div className="min-w-[700px] h-full flex flex-col">
                    {/* Weekday headers */}
                    <div className="grid grid-cols-7 bg-gray-100 border-b border-gray-200 shrink-0 sticky top-0 z-10">
                        {[0, 1, 2, 3, 4, 5, 6].map(d => (
                            <div key={d} className={`text-center py-2 text-xs font-bold uppercase tracking-wider ${d === 0 || d === 6 ? 'text-red-500' : 'text-gray-500'}`}>
                                {getWeekdayShort(d)}
                            </div>
                        ))}
                    </div>

                    {/* Calendar grid */}
                    <div className="grid grid-cols-7 flex-1 bg-gray-200 gap-px">
                        {cells}
                    </div>
                </div>
            </div>
        </div>
    );
}
