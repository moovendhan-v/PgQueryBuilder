import {
    QueryBuilder,
    ResponseMapper,
    PaginationBuilder,
    FilterOperations,
    DateFilterUtils,
    FieldMapping,
    QueryOptions,
    PaginationResult
} from '../src/QueryBuilder';

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

class QueryBuilderTestSuite {
    private testResults: { condition: boolean; message: string }[] = [];
    private passCount = 0;
    private failCount = 0;

    private log(testName: string, query: { text: string; values: any[] }, description = ''): void {
        console.log('\n' + '='.repeat(80));
        console.log(`🧪 TEST: ${testName}`);
        if (description) console.log(`📝 Description: ${description}`);
        console.log('📋 Generated SQL Query:');
        console.log('-'.repeat(40));
        console.log(query.text.trim());
        console.log('-'.repeat(40));
        console.log('🔧 Parameters:', query.values);
        console.log('='.repeat(80));
    }

    private assert(condition: boolean, message: string): void {
        if (condition) {
            console.log(`✅ PASS: ${message}`);
            this.passCount++;
        } else {
            console.log(`❌ FAIL: ${message}`);
            this.failCount++;
        }
        this.testResults.push({ condition, message });
    }

    testBasicSelectQuery(): void {
        const builder = new QueryBuilder(SCHEMA, userFieldMappings, true);
        const { selectQuery, countQuery } = builder.buildSelectQuery({
            tableName: 'users',
            fields: ['id', 'username', 'createdAt'],
            requiredFilters: { isActive: true },
            limit: 10,
            offset: 0
        });
        this.log('Basic Select Query', selectQuery, 'Simple select with required filters and basic fields');
        this.assert(selectQuery.text.includes('SELECT users.id, users.username, users.created_at'), 'Should select correct fields');
        this.assert(selectQuery.text.includes('WHERE users.is_active = $1'), 'Should include required filter');
        this.assert(selectQuery.values.includes(true), 'Should include parameter value');
    }

    testAdvancedFiltering(): void {
        const builder = new QueryBuilder(SCHEMA, userFieldMappings, true);
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
        this.log('Advanced Filtering Query', selectQuery, 'Complex query with multiple filter types');
        this.assert(selectQuery.text.includes('ILIKE'), 'Should include ILIKE operations for string filters');
        this.assert(selectQuery.text.includes('IN ('), 'Should include IN operations');
        this.assert(selectQuery.text.includes('NOT IN ('), 'Should include NOT IN operations');
        this.assert(selectQuery.text.includes('jsonb'), 'Should include JSONB operations');
        this.assert(selectQuery.text.includes('!='), 'Should include not equals operation');
    }

    testJoinWithProfiles(): void {
        const builder = new QueryBuilder(SCHEMA, userFieldMappings, true)
            .addJoin('LEFT JOIN', 'profiles', 'users.profile_id = profiles.id');
        const { selectQuery } = builder.buildSelectQuery({
            tableName: 'users',
            fields: ['id', 'username', 'email', 'createdAt'],
            queryParams: { username_like: 'john' },
            limit: 5,
            offset: 0
        });
        this.log('Join with Profiles', selectQuery, 'Testing join with profiles table');
        this.assert(selectQuery.text.includes('LEFT JOIN profiles ON users.profile_id = profiles.id'), 'Should include LEFT JOIN with profiles');
        this.assert(selectQuery.text.includes('users.username ILIKE'), 'Should include filter condition');
    }

    testWithClause(): void {
        const builder = new QueryBuilder(SCHEMA, userFieldMappings, true)
            .addWithClause('active_users', `SELECT id FROM users WHERE is_active = true`);
        const { selectQuery } = builder.buildSelectQuery({
            tableName: 'users',
            fields: ['id', 'username'],
            queryParams: { isActive: true },
            limit: 10,
            offset: 0
        });
        this.log('WITH Clause Query', selectQuery, 'Query with WITH clause (CTE)');
        this.assert(selectQuery.text.includes('WITH active_users AS'), 'Should include WITH clause');
    }

    testAggregationQuery(): void {
        const builder = new QueryBuilder(SCHEMA, profileFieldMappings, true);
        const aggregateQuery = builder.buildAggregateQuery({
            tableName: 'profiles',
            aggregates: {
                avgAge: { function: 'AVG', field: 'age' },
                maxAge: { function: 'MAX', field: 'age' }
            },
            groupBy: ['country'],
            requiredFilters: { country: 'USA' },
            queryParams: { age_gte: 18 }
        });
        this.log('Aggregation Query', aggregateQuery, 'Aggregation with AVG, MAX, and GROUP BY country');
        this.assert(aggregateQuery.text.includes('AVG(profiles.age) AS avgAge'), 'Should include AVG aggregation');
        this.assert(aggregateQuery.text.includes('GROUP BY profiles.country'), 'Should include GROUP BY clause');
    }

    testFullTextSearch(): void {
        const builder = new QueryBuilder(SCHEMA, userFieldMappings, true);
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
        this.log('Full-Text Search Filtering', selectQuery, 'Testing full-text search operators');
        this.assert(selectQuery.text.includes("to_tsvector('english', users.username) @@('developer')"), 'Should include fts operation');
        this.assert(selectQuery.text.includes('plainto_tsquery'), 'Should include ftsPlain operation');
        this.assert(selectQuery.text.includes('phraseto_tsquery'), 'Should include ftsPhrase operation');
        this.assert(selectQuery.text.includes('websearch_to_tsquery'), 'Should include ftsWeb operation');
    }

    testDateRangeFiltering(): void {
        const builder = new QueryBuilder(SCHEMA, userFieldMappings, true);
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
        this.log('Date Range Filtering', selectQuery, 'Testing month-year filter, date range between, year filter, and notBetween');
        this.assert(selectQuery.text.includes('BETWEEN'), 'Should include BETWEEN operations');
        this.assert(selectQuery.text.includes('NOT BETWEEN'), 'Should include NOT BETWEEN operation');
    }

    testEdgeCases(): void {
        const builder = new QueryBuilder(SCHEMA, userFieldMappings, true);
        try {
            builder.buildSelectQuery({
                tableName: 'users',
                fields: ['invalidField'],
                limit: 10,
                offset: 0
            });
            this.assert(false, 'Should throw error for invalid field');
        } catch (error) {
            this.assert(true, 'Should throw error for invalid field');
        }
        try {
            builder.buildSelectQuery({
                tableName: 'users',
                fields: ['id'],
                sortField: 'status',
                limit: 10,
                offset: 0
            });
            this.assert(false, 'Should throw error for computed sort field');
        } catch (error) {
            this.assert(true, 'Should throw error for computed sort field');
        }
    }

    testPaginationAndSorting(): void {
        const builder = new QueryBuilder(SCHEMA, userFieldMappings, true);
        const { selectQuery } = builder.buildSelectQuery({
            tableName: 'users',
            fields: ['id', 'createdAt', 'username'],
            queryParams: { isActive: true },
            limit: 50,
            offset: 100,
            sortField: 'username',
            sortDirection: 'ASC'
        });
        this.log('Pagination and Sorting', selectQuery, 'Testing custom sort field with ASC direction and pagination');
        this.assert(selectQuery.text.includes('ORDER BY users.username ASC'), 'Should sort by specified field in ASC order');
        this.assert(selectQuery.text.includes('LIMIT $2 OFFSET $3'), 'Should include proper pagination parameters');
        this.assert(selectQuery.values.includes(50) && selectQuery.values.includes(100), 'Should include limit and offset values');
    }

    testResponseMapping(): void {
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
        this.assert(mappedResult.username === 'TestUser', 'Should map username field');
        this.assert(mappedResult.status === 'ACTIVE', 'Should map computed status field');
        this.assert(Array.isArray(mappedResult.tags), 'Should map array field');
        this.assert(typeof mappedResult.metadata === 'object', 'Should map JSONB field');
    }

    testUtilityClasses(): void {
        const monthRange = DateFilterUtils.getMonthRange(2023, 3);
        const yearRange = DateFilterUtils.getYearRange(2023);
        this.assert(monthRange.start.startsWith('2023-02-28'), 'Should generate correct month range');
        this.assert(yearRange.start.startsWith('2022-12-31'), 'Should generate correct year range');
        const pagination: PaginationResult = PaginationBuilder.build(250, 20, 40);
        this.assert(pagination.totalPages === 13, 'Should calculate correct total pages');
        this.assert(pagination.pageNumber === 2, 'Should calculate correct current page');
        this.assert(pagination.hasNextPage === true, 'Should detect next page availability');
    }

    runAllTests(): void {
        console.log('\n🚀 Starting Query Builder Test Suite...\n');
        this.testBasicSelectQuery();
        this.testAdvancedFiltering();
        this.testJoinWithProfiles();
        this.testWithClause();
        this.testAggregationQuery();
        this.testFullTextSearch();
        this.testDateRangeFiltering();
        this.testEdgeCases();
        this.testPaginationAndSorting();
        this.testResponseMapping();
        this.testUtilityClasses();
        this.printSummary();
    }

    private printSummary(): void {
        console.log('\n' + '🏁 TEST SUMMARY '.padStart(50, '=').padEnd(80, '='));
        console.log(`✅ Passed: ${this.passCount}`);
        console.log(`❌ Failed: ${this.failCount}`);
        console.log(`📊 Total: ${this.passCount + this.failCount}`);
        console.log(`🎯 Success Rate: ${((this.passCount / (this.passCount + this.failCount)) * 100).toFixed(1)}%`);
        console.log('='.repeat(80));
        if (this.failCount > 0) {
            console.log('\n❌ Failed Tests:');
            this.testResults.filter(result => !result.condition).forEach(result => console.log(`  - ${result.message}`));
        }
    }
}

const testSuite = new QueryBuilderTestSuite();
testSuite.runAllTests();

export default QueryBuilderTestSuite;