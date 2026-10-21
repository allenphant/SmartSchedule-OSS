'use client';

import {
    XCircle, Calendar, Lock, Paintbrush, ChevronDown, Plus, RotateCcw,
    Coffee, Sun, Moon, Filter, Clock, Briefcase,
} from 'lucide-react';
import {
    TIME_SLOTS, getAvailabilitySummary, calculateBillableHours,
    validateManagerAssignment, getStoreValidation,
    generateSlotsFromRange, getShiftDetails, getConsecutiveWorkDays
} from '@/lib/utils/time';
import { useState, useRef, useEffect, useCallback } from 'react';

// ─── Shift template definitions ───────────────────────────────────────────────

export interface ShiftTemplate {
    id: string;
    name: string;
    color: string;
    start: string;
    end: string;
}

const DEFAULT_TEMPLATES: ShiftTemplate[] = [
    { id: 't1', name: '早班 9h', color: 'text-blue-700', start: '08:30', end: '18:30' },
    { id: 't2', name: '早班 8h', color: 'text-blue-700', start: '08:30', end: '17:30' },
    { id: 't3', name: '早班 6h', color: 'text-blue-700', start: '08:30', end: '15:00' },
    { id: 't4', name: '早班 4h', color: 'text-blue-700', start: '08:30', end: '12:30' },
    { id: 't5', name: '8h (09-18)', color: 'text-gray-700', start: '09:00', end: '18:00' },
    { id: 't6', name: '6h (09-15:30)', color: 'text-gray-700', start: '09:00', end: '15:30' },
    { id: 't7', name: '6h (10-16:30)', color: 'text-gray-700', start: '10:00', end: '16:30' },
    { id: 't8', name: '4h (10-14)', color: 'text-gray-700', start: '10:00', end: '14:00' },
    { id: 't9', name: '4h (11:30-15:30)', color: 'text-gray-700', start: '11:30', end: '15:30' },
    { id: 't10', name: '6h (12-18:30)', color: 'text-gray-700', start: '12:00', end: '18:30' },
    { id: 't11', name: '晚班 9h', color: 'text-purple-700', start: '11:30', end: '21:30' },
    { id: 't12', name: '晚班 8h', color: 'text-purple-700', start: '12:30', end: '21:30' },
    { id: 't13', name: '晚班 6h', color: 'text-purple-700', start: '15:00', end: '21:30' },
    { id: 't14', name: '晚班 4h', color: 'text-purple-700', start: '17:30', end: '21:30' },
    { id: 't15', name: '晚班 3h', color: 'text-purple-700', start: '18:30', end: '21:30' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ShiftRecord {
    userId: string;
    date: string;
    assignedSlots: string[];
    _userType?: string;
}

export interface AvailabilityRecord {
    userId: string;
    date: string;
    type: 'available' | 'leave';
    slots: string[];
    leaveReason?: string;
}

export interface UserRecord {
    id: string;
    name: string;
    role: 'manager' | 'staff';
    type: 'fulltime' | 'parttime';
    avatar: string;
    hourlyRate: number | null; // 只有店長（與本人）看得到時薪
}

interface ShiftDetailModalProps {
    dateStr: string;
    currentUser: UserRecord;
    allUsers: UserRecord[];
    isClosed: boolean;
    isSchedulingLocked: boolean;
    myAvail: AvailabilityRecord | null | undefined;
    dayAvailabilities: AvailabilityRecord[];
    dayShifts: ShiftRecord[];
    allShifts: ShiftRecord[];
    nationalHolidays: string[];
    onClose: () => void;
    onSaveStaff: (dateStr: string, type: string, slots: string[], reason: string) => void;
    onToggleStoreClosed: () => void;
    onUpdateShift: (dateStr: string, userId: string, slots: string[]) => void;
    getMonthlyHours: (userId: string) => number;
    onResetDay: () => void;
}

// ─── Dropdown with outside-click close ────────────────────────────────────────

function useDropdown() {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);
    return { open, setOpen, ref };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ShiftDetailModal({
    dateStr, currentUser, allUsers, isClosed, isSchedulingLocked, myAvail, dayAvailabilities, dayShifts,
    allShifts, nationalHolidays, onClose, onSaveStaff, onToggleStoreClosed, onUpdateShift, getMonthlyHours, onResetDay,
}: ShiftDetailModalProps) {

    // Staff state
    const [tempType, setTempType] = useState<'available' | 'leave'>(myAvail?.type ?? 'available');
    const [tempSlots, setTempSlots] = useState<string[]>(myAvail?.slots ?? []);
    const [tempReason, setTempReason] = useState(myAvail?.leaveReason ?? '事假');
    const [quickTime, setQuickTime] = useState('17:00');

    // Manager state
    const isDragging = useRef(false);
    const brushDropdown = useDropdown();
    const [selectedBrush, setSelectedBrush] = useState<ShiftTemplate | 'eraser' | null>(null);
    const [customTemplates, setCustomTemplates] = useState<ShiftTemplate[]>([]);
    const [showTemplateCreator, setShowTemplateCreator] = useState(false);
    const [newTemplate, setNewTemplate] = useState({ name: '', start: '08:30', end: '21:30' });
    const [unavailableError, setUnavailableError] = useState<string | null>(null);

    const isNationalHoliday = nationalHolidays.includes(dateStr);
    const getWeekday = (d: string) => ['週日', '週一', '週二', '週三', '週四', '週五', '週六'][new Date(d).getDay()];
    // We want to show ALL users (including managers) in the schedule list so they can be assigned shifts.
    const staffUsers = allUsers;
    const storeValidation = getStoreValidation(dateStr, dayShifts);

    const showError = (msg: string) => {
        setUnavailableError(msg);
        setTimeout(() => setUnavailableError(null), 3000);
    };

    // Check if a slot is within user's available range
    const isSlotAvailable = (slotId: string, userId: string): boolean => {
        const userAvail = dayAvailabilities.find(a => a.userId === userId);
        if (!userAvail || userAvail.type === 'leave') return false;
        return userAvail.slots.includes(slotId);
    };

    // ── Staff handlers ──────────────────────────────────────────────────────
    const handleToggleSlot = (slotId: string) => {
        if (tempType === 'leave') return;
        setTempSlots(prev =>
            prev.includes(slotId) ? prev.filter(s => s !== slotId) : [...prev, slotId].sort()
        );
    };

    const handleDragSlot = (slotId: string) => {
        if (isDragging.current && tempType === 'available' && !tempSlots.includes(slotId)) {
            setTempSlots(prev => Array.from(new Set([...prev, slotId])).sort());
        }
    };

    const handleQuickSelect = (mode: string) => {
        const [h, m] = quickTime.split(':').map(Number);
        const targetVal = h * 60 + m;
        if (mode === 'all') setTempSlots(TIME_SLOTS.map(s => s.id));
        else if (mode === 'reset') setTempSlots([]);
        else if (mode === 'before') setTempSlots(TIME_SLOTS.filter(s => s.val < targetVal).map(s => s.id));
        else if (mode === 'after') setTempSlots(TIME_SLOTS.filter(s => s.val + 30 <= targetVal || s.val >= targetVal).filter(s => s.val >= targetVal).map(s => s.id));
    };

    // ── Manager handlers ────────────────────────────────────────────────────

    const applyBrushToSlots = (slotId: string, userId: string, current: string[]): string[] | null => {
        const userAvail = dayAvailabilities.find(a => a.userId === userId);
        const hasAvail = userAvail && userAvail.type === 'available' && userAvail.slots.length > 0;

        if (hasAvail && !isSlotAvailable(slotId, userId)) {
            showError(`⚠️ ${allUsers.find(u => u.id === userId)?.name} 這個時段沒有填寫可上班`);
            return null;
        }
        if (current.includes(slotId)) return current.filter(s => s !== slotId);
        return [...current, slotId].sort();
    };

    const handleManagerCellMouseDown = (slotId: string, userId: string) => {
        isDragging.current = true;
        const current = dayShifts.find(s => s.userId === userId)?.assignedSlots ?? [];
        const next = applyBrushToSlots(slotId, userId, current);
        if (next !== null) onUpdateShift(dateStr, userId, next);
    };

    const handleManagerCellMouseEnter = (slotId: string, userId: string) => {
        if (!isDragging.current) return;
        const current = dayShifts.find(s => s.userId === userId)?.assignedSlots ?? [];
        if (current.includes(slotId)) return;
        const userAvail = dayAvailabilities.find(a => a.userId === userId);
        const hasAvail = userAvail && userAvail.type === 'available' && userAvail.slots.length > 0;
        if (hasAvail && !isSlotAvailable(slotId, userId)) return; // silently skip during drag
        onUpdateShift(dateStr, userId, [...current, slotId].sort());
    };

    const handleColumnClick = (userId: string) => {
        if (!selectedBrush) return;
        if (selectedBrush === 'eraser') {
            onUpdateShift(dateStr, userId, []);
            return;
        }

        const templateSlots = generateSlotsFromRange(selectedBrush.start, selectedBrush.end);
        const userAvail = dayAvailabilities.find(a => a.userId === userId);
        const hasAvail = userAvail && userAvail.type === 'available' && userAvail.slots.length > 0;

        if (hasAvail) {
            const blocked = templateSlots.filter(s => !userAvail.slots.includes(s));
            if (blocked.length > 0) {
                showError(`⚠️ ${allUsers.find(u => u.id === userId)?.name} 有 ${blocked.length} 個時段沒空，無法套用`);
                return;
            }
        }
        onUpdateShift(dateStr, userId, templateSlots);
    };

    const saveCustomTemplate = () => {
        if (!newTemplate.name) return;
        setCustomTemplates(prev => [
            ...prev,
            { ...newTemplate, id: `c${Date.now()}`, color: 'text-gray-700' }
        ]);
        setShowTemplateCreator(false);
        setNewTemplate({ name: '', start: '08:30', end: '21:30' });
    };

    const myShiftInfo = currentUser.role === 'staff' ? dayShifts.find(s => s.userId === currentUser.id) : null;
    const myShiftDetails = myShiftInfo ? getShiftDetails(myShiftInfo.assignedSlots) : null;

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onMouseUp={() => { isDragging.current = false; }}
        >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* ── Header ───────────────────────────────────────────── */}
                <div className={`p-4 flex justify-between items-center text-white shrink-0 ${isClosed ? 'bg-red-600' : 'bg-slate-800'}`}>
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        {dateStr} ({getWeekday(dateStr)})
                        {isNationalHoliday && (
                            <span className="bg-yellow-400 text-black text-xs px-2 py-0.5 rounded font-bold">國定假日</span>
                        )}
                        {isClosed && <span className="text-sm opacity-90 ml-2">🔒 本日店休中</span>}
                    </h3>
                    <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full transition-colors">
                        <XCircle className="w-6 h-6" />
                    </button>
                </div>

                {/* Error toast */}
                {unavailableError && (
                    <div className="mx-4 mt-2 px-4 py-2 bg-red-100 border border-red-300 text-red-700 text-sm font-bold rounded-xl text-center shadow shrink-0 transition-all">
                        {unavailableError}
                    </div>
                )}

                {/* ── Body ─────────────────────────────────────────────── */}
                <div className="flex-1 overflow-hidden flex flex-col bg-gray-50 min-h-0">

                    {/* ─── MANAGER VIEW ─── */}
                    {currentUser.role === 'manager' && (
                        <div className="flex flex-col h-full min-h-0 relative">
                            {/* Toolbar — overflow-visible so brush dropdown can spill over the grid below */}
                            <div className="bg-white border-b border-gray-200 p-2 flex flex-wrap items-center gap-2 shadow-sm shrink-0 z-30 relative overflow-visible">

                                {/* #7 Store-closed button: same size as brush selector, red, LEFT of brush */}
                                {!isClosed ? (
                                    <button
                                        onClick={onToggleStoreClosed}
                                        className="flex items-center gap-1.5 px-2 py-1 md:px-3 md:py-1.5 rounded-lg border text-xs md:text-sm font-bold transition-all bg-red-50 border-red-300 text-red-700 hover:bg-red-100"
                                    >
                                        <Lock className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                        設為店休
                                    </button>
                                ) : (
                                    <button
                                        onClick={onToggleStoreClosed}
                                        className="flex items-center gap-1.5 px-2 py-1 md:px-3 md:py-1.5 rounded-lg border text-xs md:text-sm font-bold transition-all bg-red-600 border-red-700 text-white hover:bg-red-700"
                                    >
                                        <Lock className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                        取消店休
                                    </button>
                                )}

                                {/* Brush selector (#2 z-[100]) */}
                                <div className="relative" ref={brushDropdown.ref}>
                                    <button
                                        onClick={() => brushDropdown.setOpen(v => !v)}
                                        className={`flex items-center gap-1.5 px-2 py-1 md:px-3 md:py-1.5 rounded-lg border text-xs md:text-sm font-bold transition-all ${selectedBrush ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                                    >
                                        <Paintbrush className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                        {selectedBrush
                                            ? (selectedBrush === 'eraser' ? '橡皮擦' : (selectedBrush as ShiftTemplate).name)
                                            : '選擇排班畫筆'}
                                        <ChevronDown className={`w-3 h-3 transition-transform ${brushDropdown.open ? 'rotate-180' : ''}`} />
                                    </button>

                                    {brushDropdown.open && (
                                        <div className="absolute top-10 left-0 bg-white border border-gray-200 rounded-xl shadow-2xl z-[100] w-64 max-h-[60vh] overflow-y-auto">
                                            <div className="p-3">
                                                <div className="text-xs font-bold text-gray-400 mb-2 uppercase">預設樣板</div>
                                                <div className="space-y-0.5">
                                                    {[...DEFAULT_TEMPLATES, ...customTemplates].map(t => (
                                                        <button
                                                            key={t.id}
                                                            onClick={() => { setSelectedBrush(t); brushDropdown.setOpen(false); }}
                                                            className={`w-full text-left px-3 py-2 rounded text-xs font-medium hover:bg-gray-100 flex justify-between items-center ${selectedBrush !== 'eraser' && (selectedBrush as ShiftTemplate)?.id === t.id ? 'bg-blue-50' : ''}`}
                                                        >
                                                            <span className={t.color}>{t.name}</span>
                                                            <span className="text-[10px] text-gray-400">{t.start}–{t.end}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className="border-t border-gray-100 mt-2 pt-2 space-y-1">
                                                    <button
                                                        onClick={() => { setSelectedBrush('eraser'); brushDropdown.setOpen(false); }}
                                                        className="w-full text-left px-3 py-2 rounded text-xs font-medium text-red-600 hover:bg-red-50"
                                                    >🧹 橡皮擦（清空此人）</button>
                                                    <button
                                                        onClick={() => { setShowTemplateCreator(true); brushDropdown.setOpen(false); }}
                                                        className="w-full flex items-center justify-center gap-1 text-xs text-blue-600 font-bold py-1.5 bg-blue-50 rounded hover:bg-blue-100"
                                                    >
                                                        <Plus className="w-3 h-3" /> 新增自訂班別
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {selectedBrush && (
                                    <button onClick={() => setSelectedBrush(null)} className="text-gray-400 hover:text-red-500 p-1">
                                        <XCircle className="w-4 h-4" />
                                    </button>
                                )}

                                <div className="ml-auto flex items-center gap-2 md:gap-3">
                                    <span className="text-[10px] md:text-xs text-gray-500">
                                        總工時: <span className={`font-bold ${storeValidation.status !== 'ok' ? 'text-red-500' : 'text-emerald-500'}`}>{storeValidation.total}hr</span>
                                    </span>
                                    <button onClick={onResetDay} className="p-1 px-1.5 md:p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded border md:border-none border-gray-200" title="重置本日所有排班">
                                        <RotateCcw className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Scrollable shift grid */}
                            <div
                                className="flex-1 overflow-auto relative select-none"
                                onMouseLeave={() => { isDragging.current = false; }}
                                onMouseUp={() => { isDragging.current = false; }}
                            >
                                {isClosed && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-40">
                                        <Lock className="w-16 h-16 mb-2 text-red-200" />
                                        <p className="font-bold text-lg text-gray-500">本日店休</p>
                                        <button onClick={onToggleStoreClosed} className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600">取消店休</button>
                                    </div>
                                )}

                                <div className="flex min-w-max">
                                    {/* Time axis — #1 z-30 > staff header z-20 */}
                                    <div className="sticky left-0 z-30 bg-white border-r border-gray-200 w-28 flex flex-col shrink-0 shadow-sm">
                                        {/* Status panel — sticky top, z-40 > everything */}
                                        <div className="h-36 sticky top-0 z-40 bg-white border-b border-gray-200 p-2 flex flex-col justify-center items-center">
                                            <span className="text-[10px] font-bold text-gray-400">STATUS</span>
                                            <span className={`text-2xl font-bold mt-1 ${storeValidation.status !== 'ok' ? 'text-red-500' : 'text-slate-800'}`}>
                                                {storeValidation.total}
                                            </span>
                                            <span className="text-[9px] text-gray-400">/ 目標 {isNationalHoliday ? '28-32' : '24-28'}</span>
                                            {storeValidation.status !== 'ok' && (
                                                <span className="text-[9px] text-red-500 font-bold bg-red-50 px-1 rounded mt-1 text-center whitespace-pre-line">
                                                    {storeValidation.msg}
                                                </span>
                                            )}
                                        </div>
                                        {/* Time labels — z-index lower than header, #1 break label is z-0 */}
                                        <div className="flex flex-col py-2">
                                            {TIME_SLOTS.map(slot => (
                                                <div key={slot.id} className="h-8 flex items-center justify-center text-[10px] font-mono text-gray-500">
                                                    {slot.display}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Staff columns */}
                                    {staffUsers.map(user => {
                                        const userShift = dayShifts.find(s => s.userId === user.id);
                                        const assignedSlots = userShift?.assignedSlots ?? [];
                                        const validation = validateManagerAssignment(user.type, assignedSlots, dateStr);
                                        const hasError = !validation.isValid;
                                        const monthlyHrs = getMonthlyHours(user.id);
                                        const userAvail = dayAvailabilities.find(a => a.userId === user.id);
                                        const isLeave = userAvail?.type === 'leave';
                                        const isPtOnHoliday = user.type === 'parttime' && isNationalHoliday;
                                        const hasAvailData = userAvail && userAvail.type === 'available' && userAvail.slots.length > 0;
                                        const availLabel = getAvailabilitySummary(userAvail?.slots);
                                        const consecutiveDays = assignedSlots.length > 0 ? getConsecutiveWorkDays(user.id, dateStr, allShifts) : 0;
                                        const isOverworked = consecutiveDays >= 3;

                                        return (
                                            <div key={user.id} className="w-36 flex flex-col border-r border-gray-100 relative">
                                                {/* User header — z-20, BELOW time axis z-30 (#1 fix) */}
                                                <div
                                                    className={`${isPtOnHoliday ? 'min-h-[9rem]' : 'h-36'} sticky top-0 z-20 bg-white border-b border-gray-200 p-2 flex flex-col justify-between cursor-pointer hover:bg-blue-50 transition-colors`}
                                                    onClick={() => handleColumnClick(user.id)}
                                                    title={selectedBrush ? `點擊套用${selectedBrush === 'eraser' ? '橡皮擦' : (selectedBrush as ShiftTemplate).name}` : ''}
                                                >
                                                    <div className="flex justify-between items-start">
                                                        <div className="relative">
                                                            <div className={`text-xl p-1 rounded-full ${hasError || isOverworked ? 'ring-2 ring-red-500 bg-red-50' : 'bg-gray-50'}`}>
                                                                {user.avatar}
                                                            </div>
                                                            <div className={`absolute -bottom-1 -right-1 text-[8px] px-1 rounded text-white ${user.type === 'fulltime' ? 'bg-indigo-500' : 'bg-orange-500'}`}>
                                                                {user.type === 'fulltime' ? 'FT' : 'PT'}
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); onUpdateShift(dateStr, user.id, []); }}
                                                            className="text-gray-300 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"
                                                        >
                                                            <RotateCcw className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-sm text-gray-800 truncate">{user.name}</div>
                                                        {isLeave
                                                            ? <div className="text-[9px] text-red-600 bg-red-50 px-1 rounded w-fit">休假</div>
                                                            : <div className="text-[9px] text-emerald-600 bg-emerald-50 px-1 rounded w-fit">{availLabel}</div>
                                                        }
                                                    </div>
                                                    <div className="border-t border-gray-100 pt-1">
                                                        <div className="flex justify-between items-center">
                                                            <span className={`text-xs font-bold font-mono ${hasError ? 'text-red-600' : 'text-slate-800'}`}>
                                                                日:{validation.totalHours}h
                                                            </span>
                                                            <span className="text-[9px] text-gray-400">月:{monthlyHrs}h</span>
                                                        </div>
                                                        {hasError && (
                                                            <div className="text-[9px] text-red-500 font-bold bg-red-50 px-1 rounded mt-0.5 truncate" title={validation.issues[0]}>
                                                                {validation.issues[0]}
                                                            </div>
                                                        )}
                                                        {isOverworked && (
                                                            <div className="text-[9px] text-red-600 font-bold bg-red-100 px-1 rounded mt-0.5 leading-tight">
                                                                ⚠️ 連續排班 {consecutiveDays} 天
                                                            </div>
                                                        )}
                                                        {isPtOnHoliday && (
                                                            <div className="text-[9px] text-orange-600 font-bold bg-orange-50 px-1 rounded mt-0.5 leading-tight">
                                                                🔴 假日排班・薪水雙倍
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Time slot cells */}
                                                <div className="flex flex-col py-2">
                                                    {TIME_SLOTS.map((slot, idx) => {
                                                        const assigned = assignedSlots.includes(slot.id);
                                                        const prevAssigned = idx > 0 && assignedSlots.includes(TIME_SLOTS[idx - 1].id);
                                                        const nextAssigned = idx < TIME_SLOTS.length - 1 && assignedSlots.includes(TIME_SLOTS[idx + 1].id);
                                                        const isAvailSlot = hasAvailData && userAvail.slots.includes(slot.id);
                                                        const isForbidden = isLeave; // PT on holiday is now ALLOWED (with warning)
                                                        const isUnavailable = hasAvailData && !isAvailSlot; // #9 staff has avail data but this slot is not in it

                                                        let cellCls = 'h-8 transition-colors relative ';
                                                        if (isForbidden) {
                                                            cellCls += 'bg-[repeating-linear-gradient(45deg,#fef2f2,#fef2f2_5px,#fee2e2_5px,#fee2e2_10px)] cursor-not-allowed';
                                                        } else if (isUnavailable && !assigned) {
                                                            // #9: staff has filled avail but this slot not included — grey out, no cursor
                                                            cellCls += 'bg-gray-100 cursor-not-allowed opacity-50';
                                                        } else if (assigned) {
                                                            cellCls += 'bg-blue-300 cursor-pointer ';
                                                            if (!prevAssigned) cellCls += 'rounded-t-lg border-b-0 ';
                                                            if (!nextAssigned) cellCls += 'rounded-b-lg ';
                                                        } else {
                                                            cellCls += isAvailSlot
                                                                ? 'bg-emerald-50 hover:bg-blue-100 cursor-pointer border-b border-emerald-100'
                                                                : 'bg-transparent hover:bg-blue-50 cursor-pointer border-b border-gray-50';
                                                        }

                                                        // Break label: show ABOVE first cell, z-10 (BELOW name card z-20) — #1
                                                        let breakLabel: React.ReactNode = null;
                                                        if (assigned && !prevAssigned) {
                                                            let len = 0;
                                                            for (let k = idx; k < TIME_SLOTS.length; k++) {
                                                                if (assignedSlots.includes(TIME_SLOTS[k].id)) len++;
                                                                else break;
                                                            }
                                                            const stats = calculateBillableHours(len);
                                                            if (stats.breakHours > 0) {
                                                                breakLabel = (
                                                                    <div className="absolute top-0 inset-x-0 z-10 flex justify-center pointer-events-none">
                                                                        <div className="bg-white/90 border border-blue-200 text-blue-800 text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-sm flex items-center gap-0.5 whitespace-nowrap">
                                                                            <Coffee className="w-2.5 h-2.5 text-amber-500" /> 休息 {stats.breakHours}h
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }
                                                        }

                                                        return (
                                                            <div
                                                                key={slot.id}
                                                                className={cellCls}
                                                                onMouseDown={() => !isForbidden && !isUnavailable && handleManagerCellMouseDown(slot.id, user.id)}
                                                                onMouseEnter={() => !isForbidden && !isUnavailable && handleManagerCellMouseEnter(slot.id, user.id)}
                                                            >
                                                                {breakLabel}
                                                                {!assigned && isAvailSlot && (
                                                                    <div className="w-1 h-1 rounded-full bg-emerald-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-60" />
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Custom template creator overlay */}
                            {showTemplateCreator && (
                                <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                                    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-xs">
                                        <h4 className="font-bold text-lg mb-4">新增自訂班別</h4>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-xs font-bold text-gray-500">班別名稱</label>
                                                <input type="text" className="w-full border rounded p-2 text-sm mt-1" placeholder="Eg. 假日短班" value={newTemplate.name} onChange={e => setNewTemplate(t => ({ ...t, name: e.target.value }))} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-xs font-bold text-gray-500">上班</label>
                                                    <select className="w-full border rounded p-2 text-sm mt-1" value={newTemplate.start} onChange={e => setNewTemplate(t => ({ ...t, start: e.target.value }))}>
                                                        {TIME_SLOTS.map(t => <option key={t.id} value={t.id}>{t.id}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-gray-500">下班</label>
                                                    <select className="w-full border rounded p-2 text-sm mt-1" value={newTemplate.end} onChange={e => setNewTemplate(t => ({ ...t, end: e.target.value }))}>
                                                        {TIME_SLOTS.map(t => <option key={t.id} value={t.end}>{t.end}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 mt-6">
                                            <button onClick={() => setShowTemplateCreator(false)} className="flex-1 py-2 text-gray-500 hover:bg-gray-100 rounded">取消</button>
                                            <button onClick={saveCustomTemplate} className="flex-1 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700">儲存</button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ─── STAFF VIEW ─── */}
                    {currentUser.role === 'staff' && (
                        isClosed ? (
                            <div className="flex flex-col items-center justify-center flex-1 text-center p-10">
                                <div className="bg-red-100 p-6 rounded-full mb-4">
                                    <Lock className="w-10 h-10 text-red-500" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-800">本日店休</h3>
                                <p className="text-gray-500 mt-2">好好休息，充電再出發！ ☕</p>
                            </div>
                        ) : isSchedulingLocked ? (
                            <div className="flex flex-col items-center justify-center flex-1 text-center p-10 border-4 border-dashed border-orange-200 m-4 rounded-3xl bg-orange-50">
                                <div className="bg-orange-100 p-6 rounded-full mb-4 shadow-inner">
                                    <Lock className="w-12 h-12 text-orange-500" />
                                </div>
                                <h3 className="text-2xl font-black text-orange-800 mb-2 tracking-wide">店長排班中</h3>
                                <p className="text-orange-600 font-bold bg-white px-4 py-2 rounded-lg shadow-sm">請勿調整填寫時間！</p>
                            </div>
                        ) : (
                            <div className="flex flex-col flex-1 p-4 overflow-hidden">
                                {/* Tab */}
                                <div className="flex p-1 bg-gray-200 rounded-lg mb-4 shrink-0">
                                    <button
                                        onClick={() => setTempType('available')}
                                        className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${tempType === 'available' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                                    >可上班</button>
                                    <button
                                        onClick={() => { setTempType('leave'); setTempSlots([]); }}
                                        className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${tempType === 'leave' ? 'bg-white shadow text-red-500' : 'text-gray-500'}`}
                                    >休假</button>
                                </div>

                                {tempType === 'leave' ? (
                                    <div className="flex flex-col items-center justify-center flex-1 bg-white p-10 rounded-2xl border border-red-100 shadow-inner space-y-4">
                                        <div className="bg-red-50 p-4 rounded-full">
                                            <Calendar className="w-12 h-12 text-red-500" />
                                        </div>
                                        <div className="text-center">
                                            <h4 className="text-xl font-black text-red-800">確認申請休假</h4>
                                            <p className="text-slate-500 mt-1">您正準備將 <span className="font-bold text-red-600">{dateStr}</span> 設為休假</p>
                                        </div>
                                        <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-amber-800 text-xs font-bold">
                                            ⚠️ 提醒：確認後店長將不會為您排定本日班表
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col flex-1 overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm min-h-0">
                                        {/* My assigned shift info card */}
                                        {myShiftDetails && (
                                            <div className="mx-3 mt-3 p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between shadow-sm shrink-0">
                                                <div className="flex items-center gap-2">
                                                    <div className="bg-blue-500 text-white p-1.5 rounded-lg"><Briefcase className="w-4 h-4" /></div>
                                                    <div>
                                                        <div className="text-xs font-bold text-blue-800 uppercase tracking-wide">已排定班表</div>
                                                        <div className="text-sm font-bold text-blue-900">{myShiftDetails.range}</div>
                                                    </div>
                                                </div>
                                                <div className="text-xl font-bold text-blue-600">{myShiftDetails.hours}<span className="text-xs ml-0.5">h</span></div>
                                            </div>
                                        )}

                                        {/* Quick select toolbar */}
                                        <div className="flex flex-wrap items-center gap-2 p-3 bg-blue-50 border-b border-blue-100 shrink-0">
                                            <span className="text-xs font-bold text-blue-700 flex items-center gap-1"><Filter className="w-3 h-3" /> 快速:</span>
                                            <button onClick={() => handleQuickSelect('all')} className="px-2 py-1 bg-white border border-blue-200 rounded text-xs font-medium text-blue-600 hover:bg-blue-100">整天</button>
                                            <button onClick={() => handleQuickSelect('reset')} className="px-2 py-1 bg-white border border-red-200 rounded text-xs font-medium text-red-500 hover:bg-red-50 flex items-center gap-1"><RotateCcw className="w-3 h-3" /> 重置</button>
                                            <div className="flex items-center bg-white rounded border border-blue-200 overflow-hidden ml-auto shadow-sm">
                                                <select value={quickTime} onChange={e => setQuickTime(e.target.value)} className="text-xs py-1 pl-2 pr-6 border-none bg-transparent focus:ring-0 text-gray-700 cursor-pointer w-24">
                                                    {TIME_SLOTS.map(t => <option key={t.id} value={t.id}>{t.id}</option>)}
                                                </select>
                                                <button onClick={() => handleQuickSelect('before')} className="px-2 py-1 hover:bg-blue-100 border-l border-blue-100 text-xs text-blue-600 font-medium">之前</button>
                                                <button onClick={() => handleQuickSelect('after')} className="px-2 py-1 hover:bg-blue-100 border-l border-blue-100 text-xs text-blue-600 font-medium">之後</button>
                                            </div>
                                        </div>

                                        {/* Hours display */}
                                        <div className="flex justify-between items-center px-4 py-2 bg-gray-50 border-b border-gray-100 shrink-0">
                                            <span className="text-sm font-bold text-gray-700 flex items-center gap-2"><Clock className="w-4 h-4" /> 選擇時段</span>
                                            <div className="flex flex-col items-end">
                                                <span className="text-sm font-bold text-emerald-600">{tempSlots.length * 0.5} hr</span>
                                                {tempSlots.length > 0 && (
                                                    <span className="text-[10px] text-gray-500 bg-gray-200 px-1.5 rounded">{getAvailabilitySummary(tempSlots)}</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Time slot list */}
                                        <div
                                            className="flex-1 overflow-y-auto min-h-0 p-2 space-y-1 select-none"
                                            onMouseDown={() => { isDragging.current = true; }}
                                            onMouseUp={() => { isDragging.current = false; }}
                                            onMouseLeave={() => { isDragging.current = false; }}
                                        >
                                            {TIME_SLOTS.map(slot => {
                                                const isSelected = tempSlots.includes(slot.id);
                                                return (
                                                    <div
                                                        key={slot.id}
                                                        onMouseEnter={() => handleDragSlot(slot.id)}
                                                        onMouseDown={() => handleToggleSlot(slot.id)}
                                                        className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer text-sm select-none ${isSelected ? 'bg-blue-500 border-blue-600 text-white shadow-md' : 'bg-white border-gray-100 text-gray-600 hover:bg-gray-50'}`}
                                                    >
                                                        <span className="font-mono font-medium pl-2">{slot.display}</span>
                                                        <div className={`flex items-center gap-2 pr-2 ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>
                                                            {slot.isOpening && <Sun className="w-4 h-4" />}
                                                            {slot.isClosing && <Moon className="w-4 h-4" />}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    )}
                </div>

                {/* ── Footer ───────────────────────────────────────────── */}
                <div className="p-4 border-t border-gray-200 bg-white flex justify-between items-center shrink-0">
                    {currentUser.role === 'manager' && (
                        <div className="flex gap-4 text-[10px] text-gray-500 items-center flex-wrap">
                            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-white border border-gray-200 rounded" /> 無排班</div>
                            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-50 border border-emerald-200 rounded" /> 員工有空</div>
                            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-300 rounded" /> 已排班</div>
                            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-gray-100 rounded opacity-50" /> 沒空時段</div>
                        </div>
                    )}
                    <div className="flex gap-3 ml-auto">
                        <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">取消</button>
                        {currentUser.role === 'staff' && !isClosed && !isSchedulingLocked && (
                            <button
                                onClick={() => onSaveStaff(dateStr, tempType, tempSlots, tempReason)}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg shadow-blue-200"
                            >確認儲存</button>
                        )}
                        {currentUser.role === 'manager' && (
                            <button onClick={onClose} className="px-6 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-900">完成</button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
