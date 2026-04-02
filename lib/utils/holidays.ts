/**
 * Fetch Taiwan public holidays from ruyut/TaiwanCalendar CDN.
 * Source: https://github.com/ruyut/TaiwanCalendar
 * Data format per entry: { date: "20260101", week: "四", isHoliday: true, description: "元旦" }
 */

interface CalendarEntry {
    date: string;       // "20260101"
    week: string;
    isHoliday: boolean;
    description: string;
}

const cache: Record<number, string[]> = {};

export async function fetchTaiwanHolidays(year: number): Promise<string[]> {
    if (cache[year]) return cache[year];

    try {
        const res = await fetch(
            `https://cdn.jsdelivr.net/gh/ruyut/TaiwanCalendar/data/${year}.json`,
            { next: { revalidate: 86400 } } // cache 24h in Next.js
        );
        if (!res.ok) throw new Error('Fetch failed');

        const data: CalendarEntry[] = await res.json();

        // Only keep named holidays (not just regular weekends)
        const holidays = data
            .filter(d => d.isHoliday && d.description && d.description !== '例假日' && d.description !== '休息日')
            .map(d => `${d.date.slice(0, 4)}-${d.date.slice(4, 6)}-${d.date.slice(6, 8)}`);

        cache[year] = holidays;
        return holidays;
    } catch (e) {
        console.warn(`[holidays] Failed to fetch ${year} holidays, using fallback`, e);
        // Fallback: well-known fixed Taiwan holidays for the year
        return getFallbackHolidays(year);
    }
}

function getFallbackHolidays(year: number): string[] {
    // Minimal hardcoded fallback (fixed national holidays only, not adjusted dates)
    return [
        `${year}-01-01`, // 元旦
        `${year}-02-28`, // 和平紀念日
        `${year}-04-04`, // 兒童節
        `${year}-04-05`, // 清明節 (approx)
        `${year}-05-01`, // 勞動節
        `${year}-06-10`, // 端午節 (approx, changes yearly)
        `${year}-09-10`, // 中秋節 (approx, changes yearly)
        `${year}-10-10`, // 國慶日
    ];
}
