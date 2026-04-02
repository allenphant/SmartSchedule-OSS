export const NATIONAL_HOLIDAYS = ['2026-02-15', '2026-02-28'];

export interface TimeSlot {
    id: string;
    display: string;
    start: string;
    end: string;
    isOpening: boolean;
    isClosing: boolean;
    val: number;
}

export function formatTimeId(date: Date): string {
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
}

export function generateTimeSlots(): TimeSlot[] {
    const slots: TimeSlot[] = [];
    let currentTime = new Date();
    currentTime.setHours(8, 30, 0, 0);
    const endTime = new Date();
    endTime.setHours(21, 30, 0, 0);

    while (currentTime < endTime) {
        const startStr = formatTimeId(currentTime);
        const endObj = new Date(currentTime);
        endObj.setMinutes(endObj.getMinutes() + 30);
        const endStr = formatTimeId(endObj);

        slots.push({
            id: startStr,
            display: `${startStr} - ${endStr}`,
            start: startStr,
            end: endStr,
            isOpening: startStr === '08:30',
            isClosing: startStr === '21:00',
            val: currentTime.getHours() * 60 + currentTime.getMinutes()
        });

        currentTime.setMinutes(currentTime.getMinutes() + 30);
    }
    return slots;
}

export const TIME_SLOTS = generateTimeSlots();

export function generateSlotsFromRange(startStr: string, endStr: string): string[] {
    const slots: string[] = [];
    const startVal = parseInt(startStr.split(':')[0]) * 60 + parseInt(startStr.split(':')[1]);
    const endVal = parseInt(endStr.split(':')[0]) * 60 + parseInt(endStr.split(':')[1]);

    TIME_SLOTS.forEach(slot => {
        if (slot.val >= startVal && (slot.val + 30) <= endVal) {
            slots.push(slot.id);
        }
    });
    return slots;
}

export function calculateBillableHours(slotsCount: number) {
    const rawHours = slotsCount * 0.5;
    let breakHours = 0;

    if (rawHours > 8) {
        breakHours = 1;
    } else if (rawHours > 4) {
        breakHours = 0.5;
    }

    return {
        raw: rawHours,
        breakHours: breakHours,
        billable: rawHours - breakHours
    };
}

export function getAvailabilitySummary(slots: string[] | undefined | null): string {
    if (!slots || slots.length === 0) return "無";
    const allSlotIds = TIME_SLOTS.map(s => s.id);
    const sortedSlots = [...slots].sort();

    if (sortedSlots.length === allSlotIds.length) return "整天";

    const slotMins = sortedSlots.map(s => {
        const [h, m] = s.split(':').map(Number);
        return h * 60 + m;
    }).sort((a, b) => a - b);

    let isContinuous = true;
    for (let i = 1; i < slotMins.length; i++) {
        if (slotMins[i] !== slotMins[i - 1] + 30) {
            isContinuous = false;
            break;
        }
    }

    if (!isContinuous) return "部分(零碎)";

    const startMin = slotMins[0];
    const endMin = slotMins[slotMins.length - 1];
    const openingMin = 8 * 60 + 30;
    const closingBlockStartMin = 21 * 60;

    const formatTime = (totalMins: number) => {
        const h = Math.floor(totalMins / 60);
        const m = totalMins % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    const startTimeStr = formatTime(startMin);
    const endTimeStr = formatTime(endMin + 30);

    if (startMin === openingMin) return `${endTimeStr} 前`;
    if (endMin === closingBlockStartMin) return `${startTimeStr} 後`;

    return `${startTimeStr}-${endTimeStr}`;
}

export interface ShiftDetails {
    range: string;
    hours: number;
}

export function getShiftDetails(assignedSlots: string[] | undefined | null): ShiftDetails | null {
    if (!assignedSlots || assignedSlots.length === 0) return null;
    const sorted = [...assignedSlots].sort();
    const startSlot = TIME_SLOTS.find(s => s.id === sorted[0]);
    const endSlotId = sorted[sorted.length - 1];
    const lastSlotVal = parseInt(endSlotId.split(':')[0]) * 60 + parseInt(endSlotId.split(':')[1]);
    const endVal = lastSlotVal + 30;
    const endH = Math.floor(endVal / 60);
    const endM = endVal % 60;
    const endStr = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;

    const { billable } = calculateBillableHours(assignedSlots.length);

    if (!startSlot) return null;

    // Format: 0830-1730
    const startFmt = startSlot.start.replace(':', '');
    const endFmt = endStr.replace(':', '');

    return {
        range: `${startFmt}-${endFmt}`,
        hours: billable
    };
}

export interface StoreValidationResult {
    status: 'ok' | 'low' | 'high';
    msg: string;
    total: number;
}

export function getStoreValidation(dateStr: string, allShifts: any[]): StoreValidationResult {
    const dayOfWeek = new Date(dateStr).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const guideline = isWeekend ? { min: 28, max: 32 } : { min: 24, max: 28 };

    const dayShifts = allShifts.filter(s => s.date === dateStr);
    const total = dayShifts.reduce((acc, s) => {
        const sorted = [...(s.assignedSlots || [])].sort();
        let blocks: string[][] = [];
        let currentBlock: string[] = [];
        sorted.forEach((slot, idx) => {
            if (idx === 0) currentBlock.push(slot);
            else {
                const prevSlotVal = parseInt(sorted[idx - 1].split(':')[0]) * 60 + parseInt(sorted[idx - 1].split(':')[1]);
                const currSlotVal = parseInt(slot.split(':')[0]) * 60 + parseInt(slot.split(':')[1]);
                if (currSlotVal === prevSlotVal + 30) currentBlock.push(slot);
                else { blocks.push(currentBlock); currentBlock = [slot]; }
            }
        });
        if (currentBlock.length > 0) blocks.push(currentBlock);

        const userDailyBillable = blocks.reduce((uAcc, b) => uAcc + calculateBillableHours(b.length).billable, 0);
        return acc + userDailyBillable;
    }, 0);

    let status: 'ok' | 'low' | 'high' = 'ok';
    let msg = '正常';

    if (total < guideline.min) {
        status = 'low';
        msg = `▼ 時數過低\n(目標 ${guideline.min}-${guideline.max})`;
    } else if (total > guideline.max) {
        status = 'high';
        msg = `▲ 時數過高\n(目標 ${guideline.min}-${guideline.max})`;
    }

    return { status, msg, total };
}

export interface ValidationIssues {
    isValid: boolean;
    issues: string[];
    totalHours: number;
    breakTime: number;
}

export function validateManagerAssignment(userType: string, assignedSlots: string[] = [], dateStr: string): ValidationIssues {
    const sorted = [...assignedSlots].sort();
    let blocks: string[][] = [];
    let currentBlock: string[] = [];

    sorted.forEach((slot, idx) => {
        if (idx === 0) {
            currentBlock.push(slot);
        } else {
            const prevSlotVal = parseInt(sorted[idx - 1].split(':')[0]) * 60 + parseInt(sorted[idx - 1].split(':')[1]);
            const currSlotVal = parseInt(slot.split(':')[0]) * 60 + parseInt(slot.split(':')[1]);
            if (currSlotVal === prevSlotVal + 30) {
                currentBlock.push(slot);
            } else {
                blocks.push(currentBlock);
                currentBlock = [slot];
            }
        }
    });
    if (currentBlock.length > 0) blocks.push(currentBlock);

    let dailyBillable = 0;
    let dailyBreak = 0;

    blocks.forEach(block => {
        const stats = calculateBillableHours(block.length);
        dailyBillable += stats.billable;
        dailyBreak += stats.breakHours;
    });

    const issues: string[] = [];
    const isNationalHoliday = NATIONAL_HOLIDAYS.includes(dateStr);

    if (userType === 'fulltime') {
        if (dailyBillable > 0 && dailyBillable < 8) issues.push('正職工時不足 8 小時');
        if (dailyBillable > 10) issues.push('正職工時超過 10 小時');
    } else if (userType === 'parttime') {
        if (isNationalHoliday && dailyBillable > 0) issues.push('國定假日禁止排工讀');
        if (dailyBillable > 0 && dailyBillable < 4) issues.push('工讀工時不足 4 小時');
        if (dailyBillable > 8) issues.push('工讀工時超過 8 小時');
    }

    return { isValid: issues.length === 0, issues, totalHours: dailyBillable, breakTime: dailyBreak };
}

export function getConsecutiveWorkDays(userId: string, dateStr: string, allShifts: any[]): number {
    const userShifts = allShifts.filter(s => s.userId === userId && s.assignedSlots && s.assignedSlots.length > 0);
    const workDates = new Set(userShifts.map(s => s.date));

    // 如果指定的 dateStr 有排班或假設我們要將它算進去，我們從 dateStr 往前後算。
    // 但是我們要注意，可能當天還沒保存，所以我們只要看如果假設當天有上班，前後連起來共幾天。
    // 在排班介面中，如果我們正要排某天，可以傳入該天來計算「包含這天」的連續天數。

    // 往回推
    let prevConsecutive = 0;
    let tempDate = new Date(dateStr);
    tempDate.setDate(tempDate.getDate() - 1);
    while (true) {
        const prevDateStr = tempDate.toISOString().split('T')[0];
        if (workDates.has(prevDateStr)) {
            prevConsecutive++;
            tempDate.setDate(tempDate.getDate() - 1);
        } else {
            break;
        }
    }

    // 往後推
    let nextConsecutive = 0;
    tempDate = new Date(dateStr);
    tempDate.setDate(tempDate.getDate() + 1);
    while (true) {
        const nextDateStr = tempDate.toISOString().split('T')[0];
        if (workDates.has(nextDateStr)) {
            nextConsecutive++;
            tempDate.setDate(tempDate.getDate() + 1);
        } else {
            break;
        }
    }

    // 將包含當天的排班算入（假設當天有排班，連同前後就是總連續天數）
    // 如果傳入這個函數，通常表示正在計算包含當天的狀況。
    return prevConsecutive + 1 + nextConsecutive;
}
