/**
 * Interface for filter operation configuration
 */
export interface FilterOperationConfig {
    operator: string;
    sqlOperator: string;
    valueTransformer?: (value: any) => any;
}

/**
 * Filter operations configuration
 */
export const FILTER_OPERATIONS: FilterOperationConfig[] = [
    // Basic Comparisons
    { operator: 'eq', sqlOperator: '=' },
    { operator: 'ne', sqlOperator: '!=' },
    { operator: 'gt', sqlOperator: '>' },
    { operator: 'gte', sqlOperator: '>=' },
    { operator: 'lt', sqlOperator: '<' },
    { operator: 'lte', sqlOperator: '<=' },

    // LIKE variants
    { operator: 'like', sqlOperator: 'ILIKE', valueTransformer: v => `%${v}%` },
    { operator: 'startsWith', sqlOperator: 'ILIKE', valueTransformer: v => `${v}%` },
    { operator: 'endsWith', sqlOperator: 'ILIKE', valueTransformer: v => `%${v}` },

    // Array and Set
    { operator: 'in', sqlOperator: 'IN' },
    { operator: 'notIn', sqlOperator: 'NOT IN' },

    // Range
    { operator: 'between', sqlOperator: 'BETWEEN' },
    { operator: 'notBetween', sqlOperator: 'NOT BETWEEN' },

    // Null Checks
    { operator: 'isNull', sqlOperator: 'IS NULL' },
    { operator: 'isNotNull', sqlOperator: 'IS NOT NULL' },

    // Dates
    { operator: 'dateRange', sqlOperator: 'BETWEEN' },
    { operator: 'monthYear', sqlOperator: 'BETWEEN' },
    { operator: 'year', sqlOperator: '=' },

    // String Contains
    { operator: 'contains', sqlOperator: 'LIKE', valueTransformer: v => `%${v}%` },
    { operator: 'notContains', sqlOperator: 'NOT LIKE', valueTransformer: v => `%${v}%` },

    // Regex
    { operator: 'regexp', sqlOperator: '~' },
    { operator: 'notRegexp', sqlOperator: '!~' },
    { operator: 'iRegexp', sqlOperator: '~*' },
    { operator: 'notIRegexp', sqlOperator: '!~*' },

    // PostgreSQL-specific Array
    { operator: 'any', sqlOperator: '= ANY' },
    { operator: 'all', sqlOperator: '= ALL' },

    // IS, NOT IS
    { operator: 'is', sqlOperator: 'IS' },
    { operator: 'not', sqlOperator: 'IS NOT' },

    // JSON (PostgreSQL JSONB)
    { operator: 'jsonContains', sqlOperator: '@>' },
    { operator: 'jsonContained', sqlOperator: '<@' },
    { operator: 'jsonKeyExists', sqlOperator: '?', valueTransformer: v => v },
    { operator: 'jsonAnyKeyExists', sqlOperator: '?|', valueTransformer: v => v },
    { operator: 'jsonAllKeysExist', sqlOperator: '?&', valueTransformer: v => v },
    { operator: 'jsonPath', sqlOperator: '#>>' },
    { operator: 'jsonPathText', sqlOperator: '#>' },
    { operator: 'jsonEq', sqlOperator: '#>>', valueTransformer: ([path, val]) => `${path} = '${val}'` },

    // Array operations
    { operator: 'overlap', sqlOperator: '&&' },
    { operator: 'contained', sqlOperator: '<@' },
    { operator: 'containsArray', sqlOperator: '@>' },

    // Full-Text Search
    { operator: 'fts', sqlOperator: '@@', valueTransformer: v => `'${v}'` },
    { operator: 'ftsPlain', sqlOperator: '@@ plainto_tsquery', valueTransformer: v => `'${v}'` },
    { operator: 'ftsPhrase', sqlOperator: '@@ phraseto_tsquery', valueTransformer: v => `'${v}'` },
    { operator: 'ftsWeb', sqlOperator: '@@ websearch_to_tsquery', valueTransformer: v => `'${v}'` },

    // Case-insensitive
    { operator: 'ciEq', sqlOperator: 'ILIKE' },
    { operator: 'ciNe', sqlOperator: 'NOT ILIKE' },

    // Column comparison
    { operator: 'col', sqlOperator: '=' },

    // Boolean
    { operator: 'isTrue', sqlOperator: '=', valueTransformer: () => true },
    { operator: 'isFalse', sqlOperator: '=', valueTransformer: () => false },

    // Null-safe (IS DISTINCT FROM)
    { operator: 'distinctFrom', sqlOperator: 'IS DISTINCT FROM' },
    { operator: 'notDistinctFrom', sqlOperator: 'IS NOT DISTINCT FROM' },
];

/**
 * Filter operation class
 */
export class FilterOperation {
    operator: string;
    sqlOperator: string;
    valueTransformer: ((value: any) => any) | null;

    constructor(operator: string, sqlOperator: string, valueTransformer: ((value: any) => any) | null = null) {
        this.operator = operator;
        this.sqlOperator = sqlOperator;
        this.valueTransformer = valueTransformer;
    }

    transform(value: any): any {
        return this.valueTransformer ? this.valueTransformer(value) : value;
    }
}

/**
 * Filter operations registry
 */
export class FilterOperations {
    private static operations: Map<string, FilterOperation> = new Map(
        FILTER_OPERATIONS.map(op => [op.operator, new FilterOperation(op.operator, op.sqlOperator, op.valueTransformer)])
    );
    private static operationCache: Map<string, FilterOperation> = new Map();

    static get(operator: string): FilterOperation {
        if (this.operationCache.has(operator)) {
            return this.operationCache.get(operator)!;
        }

        const operation = this.operations.get(operator);
        if (!operation) {
            throw new Error(`Unsupported filter operation: ${operator}`);
        }

        this.operationCache.set(operator, operation);
        return operation;
    }
} 