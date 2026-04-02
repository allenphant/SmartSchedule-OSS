'use client';

import { useState, useEffect, useTransition } from 'react';
import { FileDown } from 'lucide-react';
import { CalendarGrid } from '@/components/schedule/CalendarGrid';
import { ShiftDetailModal, UserRecord, ShiftRecord, AvailabilityRecord } from '@/components/ui/ShiftDetailModal';
import { exportScheduleToExcel } from '@/lib/utils/exportSchedule';
import { fetchTaiwanHolidays } from '@/lib/utils/holidays';
import { upsertShift, getMonthlyShifts } from '@/lib/actions/shifts';
import { upsertAvailability, getMonthlyAvailabilities, getMyAvailabilities, getMyConfirmations, confirmRegistration } from '@/lib/actions/availability';
import { upsertClosedDates, getMonthlyConfig } from '@/lib/actions/monthlyConfig';
import { clearSelectedStore, toggleAutoLockScheduling } from '@/lib/actions/stores';
import { signOut } from '@/lib/actions/auth';
import { ManagerApprovalModal } from './ManagerApprovalModal';
import { StoreSwitchButton } from './StoreSwitchButton';
import { ReviewSummaryModal } from './ReviewSummaryModal';
import { UserPlus, Users, LogOut, Loader2, X, UserCog, User, Lock, Unlock, ClipboardCheck, AlertTriangle } from 'lucide-react';

// ── 資料映射工具：DB Row → 前端 Record ────────────────────────────────────
function initials(name: string) {
    return name.slice(0, 1); // 只取第一個字
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbShifts(dbShifts: any[]): ShiftRecord[] {
    return dbShifts.map(s => ({
        userId: s.user_id,
        date: s.date,
        assignedSlots: s.assigned_slots ?? [],
        _userType: s.profiles?.employment_type,
    }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbAvailabilities(dbAvails: any[]): AvailabilityRecord[] {
    return dbAvails.map(a => ({
        userId: a.user_id,
        date: a.date,
        type: a.type as 'available' | 'leave',
        slots: a.slots ?? [],
        leaveReason: a.leave_reason ?? undefined,
    }));
}

// ── Props ──────────────────────────────────────────────────────────────────
interface ScheduleClientProps {
    currentUser: UserRecord;
    allUsers: UserRecord[];
    storeName: string;
    isMultiStoreManager: boolean;  // 是否顯示切換分店按鈕
    initialYearMonth: string;
    initialShifts: ShiftRecord[];
    initialAvailability: AvailabilityRecord[];
    initialStoreClosed: string[];
    initialAutoLock: boolean;
    pendingCount: number;
    storeId: string;
}

export function ScheduleClient({
    currentUser,
    allUsers,
    storeName,
    isMultiStoreManager,
    initialYearMonth,
    initialShifts,
    initialAvailability,
    initialStoreClosed,
    initialAutoLock,
    pendingCount,
    storeId,
}: ScheduleClientProps) {
    const [currentDate, setCurrentDate] = useState(() => {
        const [y, m] = initialYearMonth.split('-').map(Number);
        return new Date(y, m - 1, 1);
    });
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [isApprovalOpen, setIsApprovalOpen] = useState(false);
    const [shifts, setShifts] = useState<ShiftRecord[]>(initialShifts);
    const [availability, setAvailability] = useState<AvailabilityRecord[]>(initialAvailability);
    const [storeClosed, setStoreClosed] = useState<string[]>(initialStoreClosed);
    const [nationalHolidays, setNationalHolidays] = useState<string[]>([]);
    const [, startTransition] = useTransition();
    const [viewMode, setViewMode] = useState<'manager' | 'personal'>('manager');
    const [isStaffListOpen, setIsStaffListOpen] = useState(false);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [autoLock, setAutoLock] = useState(initialAutoLock);
    const [isLocking, setIsLocking] = useState(false);
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [confirmedPeriods, setConfirmedPeriods] = useState<number[]>([]);

    const handleSignOut = async () => {
        setIsSigningOut(true);
        await signOut();
    };

    // 抓台灣國定假日（CDN）與 登記確認狀態
    useEffect(() => {
        fetchTaiwanHolidays(currentDate.getFullYear()).then(setNationalHolidays);
        
        const ym = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        // 無論角色，只要是登入者都抓取自己的確認狀態
        getMyConfirmations(ym).then(res => {
            if (res.success && res.data) {
                setConfirmedPeriods(res.data.map((c: any) => c.period));
            }
        });
    }, [currentDate.getFullYear(), currentDate.getMonth()]);

    // 切換月份 → 重新抓資料
    const handleDateChange = (date: Date) => {
        setCurrentDate(date);
        const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        startTransition(async () => {
            // 並行抓四個資料源
            const [shiftsRes, availRes, configRes, confirmRes] = await Promise.all([
                getMonthlyShifts(ym, storeId),
                currentUser.role === 'manager'
                    ? getMonthlyAvailabilities(ym, storeId)
                    : getMyAvailabilities(ym),
                getMonthlyConfig(ym),
                getMyConfirmations(ym)
            ]);

            if (shiftsRes.success && shiftsRes.data) setShifts(mapDbShifts(shiftsRes.data));
            if (availRes.success && availRes.data) {
                setAvailability(mapDbAvailabilities(availRes.data as any[]));
            }
            if (configRes.success) {
                setStoreClosed(configRes.data?.closed_dates ?? []);
            }
            if (confirmRes.success && confirmRes.data) {
                setConfirmedPeriods(confirmRes.data.map((c: any) => c.period));
            }
        });
    };

    // ── Handlers ────────────────────────────────────────────────────────────

    const handleConfirmRegistration = async (period: number) => {
        const ym = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        const res = await confirmRegistration(ym, period);
        if (res.success) {
            setConfirmedPeriods(prev => [...prev, period]);
        } else {
            alert('確認登記失敗：' + res.error);
        }
    };

    const handleSaveStaff = (dateStr: string, type: string, slots: string[], reason: string) => {
        // 樂觀更新
        setAvailability(prev => {
            const filtered = prev.filter(a => !(a.userId === currentUser.id && a.date === dateStr));
            return [...filtered, { userId: currentUser.id, date: dateStr, type: type as 'available' | 'leave', slots, leaveReason: reason }];
        });
        setSelectedDate(null);

        // 後端同步（背景）
        startTransition(async () => {
            await upsertAvailability({ date: dateStr, type: type as 'available' | 'leave', slots, leave_reason: reason });
        });
    };

    const handleToggleAutoLock = async () => {
        setIsLocking(true);
        const newValue = !autoLock;
        setAutoLock(newValue); // 樂觀更新

        const res = await toggleAutoLockScheduling(storeId, newValue);
        if (!res.success) {
            setAutoLock(!newValue); // rollback
            alert('更新設定失敗：' + res.error);
        }
        setIsLocking(false);
    };

    const handleToggleStoreClosed = () => {
        if (!selectedDate) return;
        const ym = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        const newClosed = storeClosed.includes(selectedDate)
            ? storeClosed.filter(d => d !== selectedDate)
            : [...storeClosed, selectedDate];

        setStoreClosed(newClosed); // 樂觀更新

        startTransition(async () => {
            await upsertClosedDates(ym, newClosed);
        });
    };

    const handleUpdateShift = (dateStr: string, userId: string, slots: string[]) => {
        const user = allUsers.find(u => u.id === userId);
        // 樂觀更新
        setShifts(prev => {
            const filtered = prev.filter(s => !(s.userId === userId && s.date === dateStr));
            if (slots.length === 0) return filtered;
            return [...filtered, { userId, date: dateStr, assignedSlots: slots, _userType: user?.type }];
        });

        // 後端同步（背景）
        startTransition(async () => {
            await upsertShift(dateStr, userId, slots, storeId);
        });
    };

    const handleResetDay = () => {
        if (!selectedDate) return;
        const dayShiftsToDelete = shifts.filter(s => s.date === selectedDate);
        setShifts(prev => prev.filter(s => s.date !== selectedDate)); // 樂觀清空

        startTransition(async () => {
            await Promise.all(dayShiftsToDelete.map(s => upsertShift(selectedDate, s.userId, [], storeId)));
        });
    };

    const getMonthlyHours = (userId: string): number => {
        const y = currentDate.getFullYear(), m = currentDate.getMonth();
        return shifts
            .filter(s => { const d = new Date(s.date); return s.userId === userId && d.getFullYear() === y && d.getMonth() === m; })
            .reduce((acc, s) => acc + (s.assignedSlots?.length ?? 0) * 0.5, 0);
    };

    // ── Derived State ────────────────────────────────────────────────────────
    const isModalOpen = !!selectedDate;
    const isDayClosed = selectedDate ? storeClosed.includes(selectedDate) : false;
    const dayShifts = selectedDate ? shifts.filter(s => s.date === selectedDate) : [];
    const dayAvailabilities = selectedDate ? availability.filter(a => a.date === selectedDate) : [];
    const myAvail = selectedDate ? availability.find(a => a.userId === currentUser.id && a.date === selectedDate) : null;

    const isLockedDay = new Date().getDate() === 13 || new Date().getDate() === 27;
    // [開發用測試] 若需測試鎖定功能，可將上方改為包含當日：new Date().getDate() === 13 || new Date().getDate() === 27 || new Date().getDate() === 21;
    const isSchedulingLocked = autoLock && isLockedDay;

    const unconfirmedPeriods = [1, 2].filter(p => !confirmedPeriods.includes(p));
    const currentMonthLabel = `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月`;

    // ── 判斷「下一期」邏輯 ──────────────────────────────────────────
    const today = new Date();
    const todayDate = today.getDate();
    const todayMonth = today.getMonth();
    const todayYear = today.getFullYear();

    let nextPeriodInfo = { year: todayYear, month: todayMonth, period: 1 as 1 | 2 };
    if (todayDate <= 15) {
        // 今天是上半月 → 下一期是「本月下半月」
        nextPeriodInfo = { year: todayYear, month: todayMonth, period: 2 };
    } else {
        // 今天是下半月 → 下一期是「下月上半月」
        const nextMonth = new Date(todayYear, todayMonth + 1, 1);
        nextPeriodInfo = { year: nextMonth.getFullYear(), month: nextMonth.getMonth(), period: 1 };
    }

    // 檢查「下一期」是否已在當前畫面顯示的月份中，且是否已確認
    const isViewingNextPeriodMonth = currentDate.getFullYear() === nextPeriodInfo.year && currentDate.getMonth() === nextPeriodInfo.month;
    const isNextPeriodUnconfirmed = !confirmedPeriods.includes(nextPeriodInfo.period);
    // 移除 role !== 'manager'，讓所有人都能看到警告
    const showWarning = isViewingNextPeriodMonth && isNextPeriodUnconfirmed;
    const nextPeriodLabel = `${nextPeriodInfo.year}年${nextPeriodInfo.month + 1}月 ${nextPeriodInfo.period === 1 ? '上半月' : '下半月'}`;

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col h-screen overflow-hidden">
            <header className="bg-white border-b border-gray-200 p-3 md:p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shrink-0">
                <div className="flex justify-between w-full md:w-auto">
                    <div>
                        <h1 className="text-lg md:text-xl font-bold flex items-center gap-2">
                            <img src="/logo.svg" alt="小木屋鬆餅" className="w-6 h-6 md:w-7 md:h-7" />
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-600 to-orange-500">小木屋鬆餅</span>
                            <span className="text-xs md:text-sm font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: 'linear-gradient(135deg, #654321, #8b5e3c)' }}>{storeName}</span>
                        </h1>
                        <div className="flex items-center gap-2 mt-1">
                            <p className="text-[10px] text-gray-400 font-medium hidden md:block">{storeName} · SmartSchedule v3.0</p>
                            {/* 切換分店按鈕（只有多店 manager 才顯示） */}
                            {isMultiStoreManager && (
                                <form action={clearSelectedStore}>
                                    <StoreSwitchButton>
                                        切換分店
                                    </StoreSwitchButton>
                                </form>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-3">
                    <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                        {/* Mode Toggle (Manager Only) */}
                    {currentUser.role === 'manager' && (
                        <div className="bg-gray-100 p-1 rounded-lg flex items-center shrink-0">
                            <button
                                onClick={() => setViewMode('manager')}
                                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold transition-all ${viewMode === 'manager' ? 'bg-white text-slate-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                <Users className="w-3.5 h-3.5" />
                                <span className="hidden md:inline">管理</span>
                            </button>
                            <button
                                onClick={() => setViewMode('personal')}
                                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold transition-all ${viewMode === 'personal' ? 'bg-white text-slate-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                <User className="w-3.5 h-3.5" />
                                <span className="hidden md:inline">個人</span>
                            </button>
                        </div>
                    )}

                    {/* Manager Approval Button */}
                    {currentUser.role === 'manager' && viewMode === 'manager' && (
                        <button
                            onClick={() => setIsApprovalOpen(true)}
                            className="flex items-center gap-1 px-2 py-1.5 md:px-3 bg-orange-100 hover:bg-orange-200 text-orange-800 text-xs md:text-sm font-bold rounded-lg shadow-sm transition-colors relative whitespace-nowrap"
                            title="員工審核"
                        >
                            <UserPlus className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            <span>審核</span>
                            {pendingCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 md:w-4 md:h-4 bg-red-500 text-white rounded-full text-[9px] md:text-[10px] flex items-center justify-center font-bold shadow-sm animate-pulse">
                                    {pendingCount}
                                </span>
                            )}
                        </button>
                    )}

                    {/* Auto Lock Toggle (Manager Only) */}
                    {currentUser.role === 'manager' && viewMode === 'manager' && (
                        <button
                            onClick={handleToggleAutoLock}
                            disabled={isLocking}
                            className={`flex items-center gap-1 px-2 py-1.5 md:px-3 text-xs md:text-sm font-bold rounded-lg shadow-sm transition-colors whitespace-nowrap ${autoLock ? 'bg-indigo-100 hover:bg-indigo-200 text-indigo-800' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
                            title={autoLock ? "自動鎖定 13/27 號：已開啟" : "自動鎖定 13/27 號：已停用"}
                        >
                            {isLocking ? <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin" /> :
                                autoLock ? <Lock className="w-3.5 h-3.5 md:w-4 md:h-4" /> : <Unlock className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            }
                            <span className="hidden md:inline">{autoLock ? '鎖定ON' : '鎖定OFF'}</span>
                        </button>
                    )}

                    {/* 員工列表按鈕 */}
                    <button
                        onClick={() => setIsStaffListOpen(true)}
                        className="flex items-center gap-1 px-2 py-1.5 md:px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm font-bold rounded-lg shadow transition-colors whitespace-nowrap"
                    >
                        <Users className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        <span>員工<span className="hidden md:inline">列表</span></span>
                    </button>

                    {/* 統整確認按鈕 (防呆) */}
                    <button
                        onClick={() => setIsReviewOpen(true)}
                        className="flex items-center gap-1 px-2 py-1.5 md:px-3 bg-orange-500 hover:bg-orange-600 text-white text-xs md:text-sm font-bold rounded-lg shadow-lg transition-all hover:scale-105 whitespace-nowrap animate-pulse-subtle"
                    >
                        <ClipboardCheck className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        <span>統整<span className="hidden md:inline">確認</span></span>
                    </button>

                    {/* 匯出 Excel — 檔名包含分店名稱 */}
                    <button
                        onClick={() => exportScheduleToExcel(
                            currentDate.getFullYear(),
                            currentDate.getMonth(),
                            shifts,
                            availability,
                            storeClosed,
                            allUsers, // 匯出所有可排班的人 (包含店長)
                            storeName,
                        )}
                        className="flex items-center gap-1 px-2 py-1.5 md:px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs md:text-sm font-bold rounded-lg shadow transition-colors whitespace-nowrap"
                    >
                        <FileDown className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        <span>匯出<span className="hidden md:inline"> Excel</span></span>
                    </button>

                    {/* 目前登入使用者 + 登出 */}
                    <div className="flex items-center gap-2 px-2 py-1.5 md:px-3 bg-orange-50 border border-orange-100 rounded-lg text-xs md:text-sm whitespace-nowrap ml-auto md:ml-0">
                        {/* 頭像圓圈（縮寫）*/}
                        <div className="w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-[10px] md:text-xs font-bold text-white shrink-0"
                            style={{ background: 'linear-gradient(135deg, #654321, #8b5e3c)' }}>
                            {currentUser.avatar}
                        </div>
                        <span className="font-medium text-gray-700 max-w-[60px] md:max-w-none truncate">{currentUser.name}</span>
                        <span className={`text-[10px] px-1 py-0.5 rounded font-bold ${currentUser.role === 'manager' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                            {currentUser.role === 'manager' ? '店長' : currentUser.type === 'fulltime' ? 'FT' : 'PT'}
                        </span>
                    </div>
                    {/* 登出按鈕 */}
                    {/* 登出按鈕 */}
                    <button
                        onClick={handleSignOut}
                        disabled={isSigningOut}
                        className="flex items-center gap-1 px-2 py-1.5 md:px-3 text-xs md:text-sm font-medium rounded-lg border transition-colors text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ borderColor: '#e2e8f0' }}
                    >
                        {isSigningOut ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                        {isSigningOut ? '登出中...' : '登出'}
                    </button>
                </div>
                </div>

                {/* 尚未登記完成警告 (橫跨 Header 底部) - REMOVED AS REQUESTED */}
            </header>

            <main className="flex-1 overflow-auto p-4">
                <div className="max-w-6xl mx-auto h-full flex flex-col">
                    <CalendarGrid
                        currentDate={currentDate}
                        onDateChange={handleDateChange}
                        onDateClick={setSelectedDate}
                        shifts={shifts}
                        availability={availability}
                        storeClosed={storeClosed}
                        currentUser={viewMode === 'personal' ? { ...currentUser, role: 'staff' } : currentUser}
                        nationalHolidays={nationalHolidays}
                        warningText={showWarning ? nextPeriodLabel : null}
                    />
                </div>
            </main>

            {isModalOpen && selectedDate && (
                <ShiftDetailModal
                    dateStr={selectedDate}
                    currentUser={viewMode === 'personal' ? { ...currentUser, role: 'staff' } : currentUser}
                    allUsers={viewMode === 'personal' ? [currentUser] : allUsers}
                    isClosed={isDayClosed}
                    isSchedulingLocked={isSchedulingLocked}
                    myAvail={myAvail}
                    dayAvailabilities={dayAvailabilities}
                    dayShifts={dayShifts}
                    allShifts={shifts}
                    nationalHolidays={nationalHolidays}
                    onClose={() => setSelectedDate(null)}
                    onSaveStaff={handleSaveStaff}
                    onToggleStoreClosed={handleToggleStoreClosed}
                    onUpdateShift={handleUpdateShift}
                    getMonthlyHours={getMonthlyHours}
                    onResetDay={handleResetDay}
                />
            )}

            {/* 員工列表 Modal */}
            {isStaffListOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                    onClick={(e) => { if (e.target === e.currentTarget) setIsStaffListOpen(false); }}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <Users className="w-5 h-5 text-gray-600" />
                                員工列表 ({allUsers.length})
                            </h3>
                            <button onClick={() => setIsStaffListOpen(false)} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {allUsers.map(u => {
                                const hours = getMonthlyHours(u.id);
                                return (
                                    <div key={u.id} className="flex items-center justify-between p-3 border rounded-xl hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shrink-0"
                                                style={{ background: 'linear-gradient(135deg, #654321, #8b5e3c)' }}>
                                                {u.avatar}
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-800 flex items-center gap-2">
                                                    {u.name}
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${u.type === 'fulltime' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {u.type === 'fulltime' ? 'FT' : 'PT'}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    時薪: ${u.hourlyRate}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-bold text-gray-800">{hours} 小時</div>
                                            <div className="text-xs text-gray-400">本月工時</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            <ManagerApprovalModal
                isOpen={isApprovalOpen}
                onClose={() => setIsApprovalOpen(false)}
                storeId={storeId}
                currentUserRole={currentUser.role}
            />

            <ReviewSummaryModal
                isOpen={isReviewOpen}
                onClose={() => setIsReviewOpen(false)}
                onConfirm={handleConfirmRegistration}
                currentDate={currentDate}
                availability={availability}
                shifts={shifts}
                storeClosed={storeClosed}
                currentUser={currentUser}
                confirmedPeriods={confirmedPeriods}
            />
        </div>
    );
}
