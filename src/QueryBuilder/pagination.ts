export interface PaginationResult {
    totalRowCount: number;
    pageSize: number;
    pageNumber: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    offset: number;
    limit: number;
}

export class PaginationBuilder {
    static build(totalCount: number, limit: number, offset: number): PaginationResult {
        const totalPages = Math.ceil(totalCount / limit);
        const currentPage = Math.floor(offset / limit);
        
        return {
            totalRowCount: totalCount,
            pageSize: limit,
            pageNumber: currentPage,
            totalPages,
            hasNextPage: currentPage < totalPages - 1,
            hasPrevPage: currentPage > 0,
            offset,
            limit
        };
    }
} 