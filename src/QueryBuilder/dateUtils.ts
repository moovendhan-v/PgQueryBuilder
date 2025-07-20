export interface DateRange {
    start: string;
    end: string;
}

export class DateFilterUtils {
    private static dateRangeCache: Map<string, DateRange> = new Map();

    static getMonthRange(year: number, month: number): DateRange {
        const cacheKey = `month:${year}-${month}`;
        if (this.dateRangeCache.has(cacheKey)) {
            return this.dateRangeCache.get(cacheKey)!;
        }

        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);
        const range: DateRange = {
            start: startDate.toISOString(),
            end: endDate.toISOString()
        };

        this.dateRangeCache.set(cacheKey, range);
        return range;
    }

    static getYearRange(year: number): DateRange {
        const cacheKey = `year:${year}`;
        if (this.dateRangeCache.has(cacheKey)) {
            return this.dateRangeCache.get(cacheKey)!;
        }

        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31, 23, 59, 59, 999);
        const range: DateRange = {
            start: startDate.toISOString(),
            end: endDate.toISOString()
        };

        this.dateRangeCache.set(cacheKey, range);
        return range;
    }

    static parseDateRange(value: string | { start: string, end: string }): DateRange {
        if (typeof value === 'string') {
            const parts = value.split(',');
            if (parts.length === 2) {
                return { start: parts[0].trim(), end: parts[1].trim() };
            }
        }
        if (typeof value === 'object' && 'start' in value && 'end' in value) {
            return value;
        }
        throw new Error('Invalid date range format. Use "start,end" or {start, end}');
    }
} 