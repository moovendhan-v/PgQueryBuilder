import { QueryBuilder } from '../src/QueryBuilder/queryBuilder';
import { FieldMapping } from '../src/QueryBuilder/fieldMapping';

export class QueryBuilderFactory {
    static createEmailQueryBuilder(schema: string, emailFieldMappings: Record<string, FieldMapping>, debug: boolean = false): QueryBuilder {
        return new QueryBuilder(schema, emailFieldMappings, debug)
            .addJoin(
                'JOIN', 
                'databank_workers_welfare dww',
                'wwe.workers_welfare_id = dww.id'
            );
    }

    static createWithAggregations(schema: string, fieldMappings: Record<string, FieldMapping>, withClauses: { name: string, query: string }[] = [], debug: boolean = false): QueryBuilder {
        const builder = new QueryBuilder(schema, fieldMappings, debug);
        withClauses.forEach(({ name, query }) => {
            builder.addWithClause(name, query);
        });
        return builder;
    }

    // New: User-Profile join builder
    static createUserProfileJoinBuilder(schema: string, userFieldMappings: Record<string, FieldMapping>, debug: boolean = false): QueryBuilder {
        return new QueryBuilder(schema, userFieldMappings, debug)
            .addJoin('LEFT JOIN', 'profiles', 'users.profile_id = profiles.id');
    }

    // New: Active users with recent signups (WITH clauses)
    static createActiveUsersWithRecentSignups(schema: string, userFieldMappings: Record<string, FieldMapping>, debug: boolean = false): QueryBuilder {
        return new QueryBuilder(schema, userFieldMappings, debug)
            .addWithClause('active_users', 'SELECT id FROM users WHERE is_active = true')
            .addWithClause('recent_signups', "SELECT id FROM users WHERE created_at > NOW() - INTERVAL '30 days'");
    }

    // New: Country aggregation for profiles
    static createCountryAggregationBuilder(schema: string, profileFieldMappings: Record<string, FieldMapping>, debug: boolean = false): QueryBuilder {
        return new QueryBuilder(schema, profileFieldMappings, debug);
    }
}

// --- TESTS ---

// Mock field mappings for users
const userFieldMappings: Record<string, FieldMapping> = {
    id: { dbField: 'users.id', type: 'uuid' },
    username: { dbField: 'users.username', type: 'string' },
    email: { dbField: 'users.email', type: 'string' },
    isActive: { dbField: 'users.is_active', type: 'boolean' },
    createdAt: { dbField: 'users.created_at', type: 'timestamp' },
    profileId: { dbField: 'users.profile_id', type: 'uuid' }
};
const profileFieldMappings: Record<string, FieldMapping> = {
    id: { dbField: 'profiles.id', type: 'uuid' },
    userId: { dbField: 'profiles.user_id', type: 'uuid' },
    bio: { dbField: 'profiles.bio', type: 'string' },
    age: { dbField: 'profiles.age', type: 'number' },
    country: { dbField: 'profiles.country', type: 'string' },
    createdAt: { dbField: 'profiles.created_at', type: 'timestamp' }
};

const SCHEMA = 'public';

function logTest(name: string, query: { text: string; values: any[] }) {
    console.log(`\n=== ${name} ===`);
    console.log(query.text.trim());
    console.log('Params:', query.values);
}

function assert(condition: boolean, message: string) {
    if (!condition) throw new Error('Assertion failed: ' + message);
}

// Test: createEmailQueryBuilder
const emailBuilder = QueryBuilderFactory.createEmailQueryBuilder(SCHEMA, userFieldMappings, true);
const { selectQuery: emailSelect } = emailBuilder.buildSelectQuery({
    tableName: 'users wwe',
    fields: ['id', 'username', 'email'],
    queryParams: { username_like: 'john' },
    limit: 5,
    offset: 0
});
logTest('Factory: createEmailQueryBuilder', emailSelect);
assert(emailSelect.text.includes('JOIN databank_workers_welfare dww ON wwe.workers_welfare_id = dww.id'), 'Should include JOIN from factory');

// Test: createWithAggregations
const withClauses = [
    { name: 'active_users', query: 'SELECT id FROM users WHERE is_active = true' },
    { name: 'recent_signups', query: 'SELECT id FROM users WHERE created_at > NOW() - INTERVAL \'30 days\'' }
];
const aggBuilder = QueryBuilderFactory.createWithAggregations(SCHEMA, userFieldMappings, withClauses, true);
const { selectQuery: aggSelect } = aggBuilder.buildSelectQuery({
    tableName: 'users',
    fields: ['id', 'username'],
    queryParams: { isActive: true },
    limit: 10,
    offset: 0
});
logTest('Factory: createWithAggregations', aggSelect);
assert(aggSelect.text.includes('WITH active_users AS'), 'Should include first WITH clause');
assert(aggSelect.text.includes('recent_signups AS'), 'Should include second WITH clause');

// Test: createUserProfileJoinBuilder
const joinBuilder = QueryBuilderFactory.createUserProfileJoinBuilder(SCHEMA, userFieldMappings, true);
const { selectQuery: joinSelect } = joinBuilder.buildSelectQuery({
    tableName: 'users',
    fields: ['id', 'username', 'profileId'],
    queryParams: { isActive: true },
    limit: 10,
    offset: 0
});
logTest('Factory: createUserProfileJoinBuilder', joinSelect);
assert(joinSelect.text.includes('LEFT JOIN profiles ON users.profile_id = profiles.id'), 'Should include LEFT JOIN from factory');

// Test: createActiveUsersWithRecentSignups
const withBuilder = QueryBuilderFactory.createActiveUsersWithRecentSignups(SCHEMA, userFieldMappings, true);
const { selectQuery: withSelect } = withBuilder.buildSelectQuery({
    tableName: 'users',
    fields: ['id', 'username'],
    queryParams: { isActive: true },
    limit: 10,
    offset: 0
});
logTest('Factory: createActiveUsersWithRecentSignups', withSelect);
assert(withSelect.text.includes('WITH active_users AS'), 'Should include active_users WITH clause');
assert(withSelect.text.includes('recent_signups AS'), 'Should include recent_signups WITH clause');

// Test: createCountryAggregationBuilder
const countryAggBuilder = QueryBuilderFactory.createCountryAggregationBuilder(SCHEMA, profileFieldMappings, true);
const aggQuery = countryAggBuilder.buildAggregateQuery({
    tableName: 'profiles',
    aggregates: {
        avgAge: { function: 'AVG', field: 'age' },
        maxAge: { function: 'MAX', field: 'age' }
    },
    groupBy: ['country'],
    requiredFilters: { country: 'USA' },
    queryParams: { age_gte: 18 }
});
logTest('Factory: createCountryAggregationBuilder', aggQuery);
assert(aggQuery.text.includes('AVG(profiles.age) AS avgAge'), 'Should include AVG aggregation');
assert(aggQuery.text.includes('GROUP BY profiles.country'), 'Should include GROUP BY clause');

console.log('\nAll factory tests passed!'); 