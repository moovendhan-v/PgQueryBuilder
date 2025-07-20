import { QueryBuilder, FieldMapping, ResponseMapper, DateFilterUtils, PaginationBuilder, PaginationResult } from '../src/QueryBuilder';

// Mock field mappings for users table
const userFieldMappings: Record<string, FieldMapping> = {
    id: { dbField: 'users.id', type: 'uuid' },
    username: { dbField: 'users.username', type: 'string' },
    email: { dbField: 'users.email', type: 'string' },
    isActive: { dbField: 'users.is_active', type: 'boolean' },
    createdAt: { dbField: 'users.created_at', type: 'timestamp' },
    profileId: { dbField: 'users.profile_id', type: 'uuid' },
    status: {
        dbField: `CASE WHEN users.is_active THEN 'ACTIVE' ELSE 'INACTIVE' END AS status`,
        type: 'string'
    },
    tags: { dbField: 'users.tags', type: 'array' },
    metadata: { dbField: 'users.metadata', type: 'jsonb' },
    ftsVector: { dbField: "to_tsvector('english', users.username)", type: 'tsvector' }
};

// Mock field mappings for profiles table
const profileFieldMappings: Record<string, FieldMapping> = {
    id: { dbField: 'profiles.id', type: 'uuid' },
    userId: { dbField: 'profiles.user_id', type: 'uuid' },
    bio: { dbField: 'profiles.bio', type: 'string' },
    age: { dbField: 'profiles.age', type: 'number' },
    country: { dbField: 'profiles.country', type: 'string' },
    createdAt: { dbField: 'profiles.created_at', type: 'timestamp' }
};

const SCHEMA = 'public';

describe('QueryBuilder Test Suite', () => {
    let builder: QueryBuilder;

    beforeEach(() => {
        builder = new QueryBuilder(SCHEMA, userFieldMappings, true);
    });

    describe('Basic Select Queries', () => {
        test('should generate basic select query with required filters', () => {
            const { selectQuery } = builder.buildSelectQuery({
                tableName: 'users',
                fields: ['id', 'username', 'createdAt'],
                requiredFilters: { isActive: true },
                limit: 10,
                offset: 0
            });

            expect(selectQuery.text).toContain('SELECT users.id, users.username, users.created_at');
            expect(selectQuery.text).toContain('WHERE users.is_active = $1');
            expect(selectQuery.values).toContain(true);
            expect(selectQuery.text).toContain('LIMIT $2 OFFSET $3');
        });

        test('should handle pagination and sorting correctly', () => {
            const { selectQuery } = builder.buildSelectQuery({
                tableName: 'users',
                fields: ['id', 'createdAt', 'username'],
                queryParams: { isActive: true },
                limit: 50,
                offset: 100,
                sortField: 'username',
                sortDirection: 'ASC'
            });

            expect(selectQuery.text).toContain('ORDER BY users.username ASC');
            expect(selectQuery.text).toContain('LIMIT $2 OFFSET $3');
            expect(selectQuery.values).toEqual(expect.arrayContaining([50, 100]));
        });
    });

    describe('Advanced Filtering', () => {
        test('should handle complex filter operations', () => {
            const { selectQuery } = builder.buildSelectQuery({
                tableName: 'users',
                fields: ['id', 'username', 'email', 'createdAt'],
                queryParams: {
                    username_like: 'john',
                    email_endsWith: '@gmail.com',
                    isActive: true,
                    createdAt_gte: '2023-01-01',
                    createdAt_lte: '2023-12-31',
                    tags_in: 'admin,editor',
                    tags_notIn: 'banned',
                    metadata_jsonKeyExists: 'role',
                    metadata_jsonContains: { role: 'admin' },
                    email_ne: 'foo@bar.com',
                },
                limit: 20,
                offset: 0,
                sortField: 'createdAt',
                sortDirection: 'DESC'
            });

            expect(selectQuery.text).toContain('ILIKE');
            expect(selectQuery.text).toContain('IN (');
            expect(selectQuery.text).toContain('NOT IN (');
            expect(selectQuery.text).toContain('jsonb');
            expect(selectQuery.text).toContain('!=');
            expect(selectQuery.text).toContain('ORDER BY users.created_at DESC');
        });

        test('should handle date range filtering', () => {
            const { selectQuery } = builder.buildSelectQuery({
                tableName: 'users',
                fields: ['id', 'createdAt'],
                queryParams: {
                    createdAt_monthYear: '2023-03',
                    createdAt_between: '2023-01-01,2023-03-31',
                    createdAt_year: '2023',
                    createdAt_notBetween: '2023-04-01,2023-04-30'
                },
                limit: 15,
                offset: 0
            });

            expect(selectQuery.text).toContain('BETWEEN');
            expect(selectQuery.text).toContain('NOT BETWEEN');
        });
    });

    describe('Full-Text Search', () => {
        test('should generate full-text search queries', () => {
            const { selectQuery } = builder.buildSelectQuery({
                tableName: 'users',
                fields: ['id', 'username'],
                queryParams: {
                    ftsVector_fts: 'developer',
                    ftsVector_ftsPlain: 'developer',
                    ftsVector_ftsPhrase: 'developer',
                    ftsVector_ftsWeb: 'developer'
                },
                limit: 10,
                offset: 0
            });

            expect(selectQuery.text).toContain("to_tsvector('english', users.username) @@('developer')");
            expect(selectQuery.text).toContain('plainto_tsquery');
            expect(selectQuery.text).toContain('phraseto_tsquery');
            expect(selectQuery.text).toContain('websearch_to_tsquery');
        });
    });

    describe('Joins and CTEs', () => {
        test('should handle joins correctly', () => {
            const builderWithJoin = new QueryBuilder(SCHEMA, userFieldMappings, true)
                .addJoin('LEFT JOIN', 'profiles', 'users.profile_id = profiles.id');
            
            const { selectQuery } = builderWithJoin.buildSelectQuery({
                tableName: 'users',
                fields: ['id', 'username', 'email', 'createdAt'],
                queryParams: { username_like: 'john' },
                limit: 5,
                offset: 0
            });

            expect(selectQuery.text).toContain('LEFT JOIN profiles ON users.profile_id = profiles.id');
            expect(selectQuery.text).toContain('users.username ILIKE');
        });

        test('should handle WITH clauses (CTEs)', () => {
            const builderWithCTE = new QueryBuilder(SCHEMA, userFieldMappings, true)
                .addWithClause('active_users', `SELECT id FROM users WHERE is_active = true`);
            
            const { selectQuery } = builderWithCTE.buildSelectQuery({
                tableName: 'users',
                fields: ['id', 'username'],
                queryParams: { isActive: true },
                limit: 10,
                offset: 0
            });

            expect(selectQuery.text).toContain('WITH active_users AS');
        });
    });

    describe('Aggregation Queries', () => {
        test('should generate aggregation queries with GROUP BY', () => {
            const profileBuilder = new QueryBuilder(SCHEMA, profileFieldMappings, true);
            const aggregateQuery = profileBuilder.buildAggregateQuery({
                tableName: 'profiles',
                aggregates: {
                    avgAge: { function: 'AVG', field: 'age' },
                    maxAge: { function: 'MAX', field: 'age' }
                },
                groupBy: ['country'],
                requiredFilters: { country: 'USA' },
                queryParams: { age_gte: 18 }
            });

            expect(aggregateQuery.text).toContain('AVG(profiles.age) AS avgAge');
            expect(aggregateQuery.text).toContain('MAX(profiles.age) AS maxAge');
            expect(aggregateQuery.text).toContain('GROUP BY profiles.country');
        });
    });

    describe('Edge Cases and Error Handling', () => {
        test('should throw error for invalid field', () => {
            expect(() => {
                builder.buildSelectQuery({
                    tableName: 'users',
                    fields: ['invalidField'],
                    limit: 10,
                    offset: 0
                });
            }).toThrow();
        });

        test('should throw error for computed sort field', () => {
            expect(() => {
                builder.buildSelectQuery({
                    tableName: 'users',
                    fields: ['id'],
                    sortField: 'status',
                    limit: 10,
                    offset: 0
                });
            }).toThrow();
        });
    });

    describe('Response Mapping', () => {
        test('should map database response correctly', () => {
            const responseMapper = new ResponseMapper(new Map(Object.entries(userFieldMappings)));
            const mockDbRow: Record<string, any> = {
                id: 'uuid-123',
                username: 'TestUser',
                email: 'test@example.com',
                is_active: true,
                created_at: '2023-01-01T10:00:00Z',
                status: 'ACTIVE',
                tags: ['admin', 'user'],
                metadata: { role: 'admin' }
            };

            const mappedResult = responseMapper.mapResponse(mockDbRow);

            expect(mappedResult.username).toBe('TestUser');
            expect(mappedResult.status).toBe('ACTIVE');
            expect(Array.isArray(mappedResult.tags)).toBe(true);
            expect(mappedResult.tags).toEqual(['admin', 'user']);
            expect(typeof mappedResult.metadata).toBe('object');
            expect(mappedResult.metadata).toEqual({ role: 'admin' });
        });
    });

    describe('Utility Classes', () => {
        test('DateFilterUtils should generate correct date ranges', () => {
            const monthRange = DateFilterUtils.getMonthRange(2023, 3);
            const yearRange = DateFilterUtils.getYearRange(2023);

            expect(monthRange.start).toMatch(/^2023-02-28/);
            expect(yearRange.start).toMatch(/^2022-12-31/);
        });

        test('PaginationBuilder should calculate pagination correctly', () => {
            const pagination: PaginationResult = PaginationBuilder.build(250, 20, 40);

            expect(pagination.totalPages).toBe(13);
            expect(pagination.pageNumber).toBe(2);
            expect(pagination.hasNextPage).toBe(true);
        });
    });

    describe('Query Structure Validation', () => {
        it('should generate proper SQL structure for complex queries', () => {
            const builder = new QueryBuilder(SCHEMA, userFieldMappings, false); // Disable debug
            
            const { selectQuery } = builder.buildSelectQuery({
                tableName: 'users',
                fields: ['id', 'username', 'email'],
                queryParams: {
                    isActive: true,
                    username_like: 'test',
                    email_ne: 'banned@example.com'
                },
                limit: 25,
                offset: 50
            });
    
            // Normalize whitespace and trim for consistent comparison
            const normalizedQuery = selectQuery.text.replace(/\s+/g, ' ').trim();
            
            // Check SQL structure components with normalized query
            expect(normalizedQuery).toMatch(/^SELECT\s+/);
            expect(normalizedQuery).toContain('FROM public.users');
            expect(normalizedQuery).toContain('WHERE');
            expect(normalizedQuery).toContain('LIMIT');
            expect(normalizedQuery).toContain('OFFSET');
            
            // Verify parameters
            expect(selectQuery.values).toEqual([
                true, 
                '%test%', 
                'banned@example.com', 
                25, 
                50
            ]);
        });
    });
});