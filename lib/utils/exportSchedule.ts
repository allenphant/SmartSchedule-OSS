import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

interface ShiftRecord {
    userId: string;
    date: string;
    assignedSlots: string[];
    _userType?: string;
}

interface AvailabilityRecord {
    userId: string;
    date: string;
    type: 'available' | 'leave';
    slots: string[];
    leaveReason?: string;
}

interface UserRecord {
    id: string;
    name: string;
    role: 'manager' | 'staff';
    type: 'fulltime' | 'parttime';
    avatar: string;
    hourlyRate: number;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function slotsToTimeRange(slots: string[]): string {
    if (!slots || slots.length === 0) return '';
    const sorted = [...slots].sort();
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const [lh, lm] = last.split(':').map(Number);
    const endMin = lh * 60 + lm + 30;
    const endH = Math.floor(endMin / 60);
    const endMStr = (endMin % 60).toString().padStart(2, '0');
    const startStr = first.replace(':', '');
    return `${startStr}-${endH}${endMStr}`;
}

function calcBillableHours(slotCount: number): number {
    const raw = slotCount * 0.5;
    if (raw >= 8) return raw - 1;
    if (raw >= 6) return raw - 0.5;
    return raw;
}

function toDateStr(y: number, m: number, d: number): string {
    return `${y}-${(m + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
}

export async function exportScheduleToExcel(
    year: number,
    month: number,
    shifts: ShiftRecord[],
    availability: AvailabilityRecord[],
    storeClosed: string[],
    staffUsers: UserRecord[],
    storeName: string = '',
) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const wb = new ExcelJS.Workbook();

    // Exactly freeze A col (xSplit: 1) and top 3 rows (ySplit: 3)
    const ws = wb.addWorksheet(`${month + 1}月班表`, {
        views: [{ state: 'frozen', xSplit: 1, ySplit: 3 }]
    });

    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

    // Helper syntax for ExcelJS styling
    const setCell = (row: number, col: number, value: any, opts: any = {}) => {
        const cell = ws.getCell(row, col);
        cell.value = value;
        cell.font = {
            name: '微軟正黑體',
            size: opts.fontSize ?? 10,
            bold: opts.bold ?? false,
            color: opts.fontColor ? { argb: 'FF' + opts.fontColor } : undefined
        };
        if (opts.bgColor) {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF' + opts.bgColor }
            };
        }
        cell.alignment = { horizontal: opts.align ?? 'center', vertical: 'middle' };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FFA6A6A6' } },
            bottom: { style: 'thin', color: { argb: 'FFA6A6A6' } },
            left: { style: 'thin', color: { argb: 'FFA6A6A6' } },
            right: { style: 'thin', color: { argb: 'FFA6A6A6' } },
        };
    };

    // ── Row 1: Date headers ───────────────────────────────────────────────
    ws.getRow(1).height = 20;
    setCell(1, 1, '日期', { bold: true, bgColor: '4472C4', fontColor: 'FFFFFF' });
    for (let d = 1; d <= daysInMonth; d++) {
        const dow = new Date(year, month, d).getDay();
        const isWE = dow === 0 || dow === 6;
        setCell(1, d + 1, d, { bold: true, bgColor: isWE ? 'ED7D31' : '4472C4', fontColor: 'FFFFFF' });
    }

    // ── Row 2: Weekday labels ─────────────────────────────────────────────
    ws.getRow(2).height = 16;
    setCell(2, 1, ts, { bgColor: 'D9D9D9', fontSize: 8 });
    for (let d = 1; d <= daysInMonth; d++) {
        const dow = new Date(year, month, d).getDay();
        const isWE = dow === 0 || dow === 6;
        setCell(2, d + 1, `星期${WEEKDAYS[dow]}`, {
            bgColor: isWE ? 'FCE4D6' : 'D9D9D9',
            fontColor: isWE ? 'E26B0A' : '404040',
            fontSize: 9,
        });
    }

    // ── Row 3: Daily totals ───────────────────────────────────────────────
    ws.getRow(3).height = 14;
    setCell(3, 1, '每日工時', { bgColor: 'D9D9D9', fontSize: 9 });
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = toDateStr(year, month, d);
        const total = shifts.filter(s => s.date === dateStr)
            .reduce((a, s) => a + calcBillableHours(s.assignedSlots?.length ?? 0), 0);
        setCell(3, d + 1, total > 0 ? total : null, {
            fontColor: 'FF0000', bold: total > 0, bgColor: 'D9D9D9', fontSize: 9
        });
    }

    // Column Widths
    ws.getColumn(1).width = 14;
    for (let d = 1; d <= daysInMonth; d++) {
        ws.getColumn(d + 1).width = 9;
    }

    // ── Staff rows ────────────────────────────────────────────────────────
    let rowIdx = 4;
    const activeUsers = staffUsers.filter(user =>
        shifts.some(s => s.userId === user.id && s.assignedSlots.length > 0)
    );

    for (const user of activeUsers) {
        ws.getRow(rowIdx).height = 18;
        ws.getRow(rowIdx + 1).height = 14;
        ws.getRow(rowIdx + 2).height = 14;

        setCell(rowIdx, 1, user.name, { bold: true, bgColor: 'DAE3F3', align: 'center' });
        setCell(rowIdx + 1, 1, '時數', { fontColor: 'FF0000', fontSize: 9, bgColor: 'FFFFFF' });
        setCell(rowIdx + 2, 1, '工作時間', { fontSize: 9, bgColor: 'FFFFFF' });

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = toDateStr(year, month, d);
            const isClosed = storeClosed.includes(dateStr);
            const userShift = shifts.find(s => s.userId === user.id && s.date === dateStr);
            const userAvail = availability.find(a => a.userId === user.id && a.date === dateStr);
            const dow = new Date(year, month, d).getDay();
            const isWE = dow === 0 || dow === 6;
            const weekendBg = isWE ? 'FFF2CC' : 'FFFFFF';

            if (isClosed) {
                setCell(rowIdx, d + 1, '店休', { bgColor: 'D9D9D9', fontSize: 9 });
                setCell(rowIdx + 1, d + 1, null, { bgColor: 'D9D9D9' });
                setCell(rowIdx + 2, d + 1, null, { bgColor: 'D9D9D9' });
            } else if (userAvail?.type === 'leave') {
                setCell(rowIdx, d + 1, '休假', { bgColor: 'FFC000', bold: true, fontSize: 9 });
                setCell(rowIdx + 1, d + 1, null, { bgColor: 'FFF2CC' });
                setCell(rowIdx + 2, d + 1, null, { bgColor: 'FFF2CC' });
            } else if (userShift && userShift.assignedSlots.length > 0) {
                const hours = calcBillableHours(userShift.assignedSlots.length);
                const range = slotsToTimeRange(userShift.assignedSlots);
                const isEarly = userShift.assignedSlots[0] <= '09:00';
                setCell(rowIdx, d + 1, isEarly ? '開早' : '', {
                    bgColor: isEarly ? 'ED7D31' : 'BDD7EE',
                    fontColor: isEarly ? 'FFFFFF' : '404040',
                    bold: isEarly, fontSize: 9
                });
                setCell(rowIdx + 1, d + 1, hours, { fontColor: 'FF0000', bold: true, fontSize: 9 });
                setCell(rowIdx + 2, d + 1, range, { fontSize: 8 });
            } else {
                setCell(rowIdx, d + 1, null, { bgColor: weekendBg });
                setCell(rowIdx + 1, d + 1, null, { bgColor: weekendBg });
                setCell(rowIdx + 2, d + 1, null, { bgColor: weekendBg });
            }
        }
        rowIdx += 3;
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const label = storeName ? `${storeName}_` : '';
    saveAs(blob, `${label}${year}年${month + 1}月班表_${ts}.xlsx`);
}
