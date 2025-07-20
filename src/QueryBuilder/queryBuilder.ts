import { FieldMapping } from './fieldMapping';
import { FieldValidator } from './fieldMapping';
import { FilterConditionBuilder } from './filterConditionBuilder';

export interface QueryOptions {
    tableName: string;
    fields?: string[] | string;
    requiredFilters?: Record<string, any>;
    queryParams?: Record<string, any>;
    excludeFields?: string[];
    limit?: number;
    offset?: number;
    sortField?: string | null;
    sortDirection?: 'ASC' | 'DESC';
}

export class QueryBuilder {
    private schema: string;
    private fieldMappings: Map<string, FieldMapping>;
    private validator: FieldValidator;
    private joins: Map<string, string>;
    private withClauses: string[];
    private queryCache: Map<string, { selectQuery: { text: string, values: any[] }, countQuery: { text: string, values: any[] } }>;
    private debug: boolean;

    constructor(schema: string, fieldMappings: Record<string, FieldMapping>, debug: boolean = false) {
        this.schema = this.sanitizeIdentifier(schema);
        this.fieldMappings = new Map(Object.entries(fieldMappings));
        this.validator = new FieldValidator(this.fieldMappings);
        this.joins = new Map();
        this.withClauses = [];
        this.queryCache = new Map();
        this.debug = debug;
    }

    private sanitizeIdentifier(identifier: string): string {
        const parts = identifier.split(/\s+/);
        let tablePart = parts[0];
        let alias: string | null = parts.length > 1 ? parts[1] : null;

        const tableParts = tablePart.split('.');
        const schema = tableParts.length > 1 ? tableParts[0] : null;
        const table = tableParts.length > 1 ? tableParts[1] : tableParts[0];

        const identifierRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

        if (schema && !identifierRegex.test(schema)) {
            throw new Error(`Invalid schema identifier: ${schema}`);
        }
        if (!identifierRegex.test(table)) {
            throw new Error(`Invalid table identifier: ${table}`);
        }
        if (alias && !identifierRegex.test(alias)) {
            throw new Error(`Invalid alias identifier: ${alias}`);
        }

        const sanitizedTable = schema ? `${schema}.${table}` : table;
        return alias ? `${sanitizedTable} ${alias}` : sanitizedTable;
    }

    addJoin(joinType: string, table: string, condition: string): this {
        const sanitizedTable = this.sanitizeIdentifier(table);
        const joinKey = `${joinType}:${sanitizedTable}`;
        if (!this.joins.has(joinKey)) {
            this.joins.set(joinKey, `${joinType} ${sanitizedTable} ON ${condition}`);
        }
        return this;
    }

    addWithClause(name: string, query: string): this {
        this.withClauses.push(`${this.sanitizeIdentifier(name)} AS (${query})`);
        return this;
    }

    private generateCacheKey({ tableName, fields, requiredFilters, sortField, sortDirection }: QueryOptions): string {
        const normalizedFields = typeof fields === 'string'
            ? fields.split(',').map(f => f.trim())
            : Array.isArray(fields)
                ? fields
                : [];
        return `${this.sanitizeIdentifier(tableName)}:${normalizedFields.join(',')}:${JSON.stringify(requiredFilters)}:${sortField}:${sortDirection}`;
    }

    buildSelectQuery(config: QueryOptions): { selectQuery: { text: string, values: any[] }, countQuery: { text: string, values: any[] } } {
        const {
            tableName,
            fields = [],
            requiredFilters = {},
            queryParams = {},
            excludeFields = [],
            limit = 10,
            offset = 0,
            sortField = null,
            sortDirection = 'DESC'
        } = config;

        const cacheKey = this.generateCacheKey({ tableName, fields, requiredFilters, sortField, sortDirection });
        if (this.queryCache.has(cacheKey)) {
            const cached = this.queryCache.get(cacheKey)!;
            const selectQuery = { text: cached.selectQuery.text, values: [...cached.selectQuery.values, limit, offset] };
            const countQuery = { text: cached.countQuery.text, values: [...cached.countQuery.values] };
            if (this.debug) {
                console.log('DEBUG: Cached Select Query:', selectQuery);
                console.log('DEBUG: Cached Count Query:', countQuery);
            }
            return { selectQuery, countQuery };
        }

        const requestedFields = typeof fields === 'string' 
            ? fields.split(',').map(f => f.trim())
            : fields;

        const selectedFields = this.validator.validateFields(requestedFields);
        const validSortField = this.validator.validateSortField(sortField);
        const orderBy = validSortField 
            ? `ORDER BY ${validSortField} ${sortDirection.toUpperCase()}`
            : `ORDER BY ${selectedFields[0]} ${sortDirection.toUpperCase()}`;

        const filterBuilder = new FilterConditionBuilder(this.fieldMappings, new Map([
            ['emailSubject', (value: string) => value.toLowerCase().trim()]
        ]));
        filterBuilder
            .addRequiredConditions(requiredFilters)
            .addDynamicFilters(queryParams, excludeFields);

        const filters = filterBuilder.build();
        const withClause = this.withClauses.length > 0 
            ? `WITH ${this.withClauses.join(', ')} `
            : '';
        const joinClause = Array.from(this.joins.values()).join(' ');

        const sanitizedTableName = this.sanitizeIdentifier(tableName);

        const selectQuery = {
            text: `
                ${withClause}
                SELECT ${selectedFields.join(', ')}
                FROM ${this.schema}.${sanitizedTableName}${joinClause}
                ${filters.text}
                ${orderBy}
                LIMIT $${filters.values.length + 1} OFFSET $${filters.values.length + 2}
            `,
            values: [...filters.values, limit, offset]
        };

        const countQuery = {
            text: `
                ${withClause}
                SELECT COUNT(1) AS count
                FROM ${this.schema}.${sanitizedTableName}${joinClause}
                ${filters.text}
            `,
            values: filters.values
        };

        this.queryCache.set(cacheKey, { selectQuery, countQuery });

        if (this.debug) {
            console.log('DEBUG: Generated Select Query:', selectQuery);
            console.log('DEBUG: Generated Count Query:', countQuery);
        }

        return { selectQuery, countQuery };
    }

    buildAggregateQuery(config: {
        tableName: string,
        aggregates?: Record<string, { function: string, field: string }>,
        groupBy?: string[],
        requiredFilters?: Record<string, any>,
        queryParams?: Record<string, any>,
        excludeFields?: string[]
    }): { text: string, values: any[] } {
        const {
            tableName,
            aggregates = {},
            groupBy = [],
            requiredFilters = {},
            queryParams = {},
            excludeFields = []
        } = config;

        const aggregateFields = Object.entries(aggregates).map(([alias, config]) => {
            const { function: func, field } = config;
            const dbField = this.fieldMappings.get(field)?.dbField || field;
            return `${func}(${dbField}) AS ${this.sanitizeIdentifier(alias)}`;
        });

        const groupByFields = groupBy.map(field => {
            const mapping = this.fieldMappings.get(field);
            return mapping ? mapping.dbField : field;
        });

        const filterBuilder = new FilterConditionBuilder(this.fieldMappings);
        filterBuilder
            .addRequiredConditions(requiredFilters)
            .addDynamicFilters(queryParams, excludeFields);

        const filters = filterBuilder.build();
        const withClause = this.withClauses.length > 0 
            ? `WITH ${this.withClauses.join(', ')} `
            : '';
        const joinClause = Array.from(this.joins.values()).join(' ');

        const sanitizedTableName = this.sanitizeIdentifier(tableName);

        const selectFields = [...groupByFields, ...aggregateFields];
        const groupByClause = groupByFields.length > 0 
            ? `GROUP BY ${groupByFields.join(', ')}`
            : '';

        const query = {
            text: `
                ${withClause}
                SELECT ${selectFields.join(', ')}
                FROM ${this.schema}.${sanitizedTableName}${joinClause}
                ${filters.text}
                ${groupByClause}
            `,
            values: filters.values
        };

        if (this.debug) {
            console.log('DEBUG: Generated Aggregate Query:', query);
        }

        return query;
    }
}