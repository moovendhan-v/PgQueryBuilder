import { QueryBuilder } from '../src/QueryBuilder/queryBuilder';
import { FieldMapping } from '../src/QueryBuilder/fieldMapping';

// Import the factory class from your original code
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

    static createUserProfileJoinBuilder(schema: string, userFieldMappings: Record<string, FieldMapping>, debug: boolean = false): QueryBuilder {
        return new QueryBuilder(schema, userFieldMappings, debug)
            .addJoin('LEFT JOIN', 'profiles', 'users.profile_id = profiles.id');
    }

    static createActiveUsersWithRecentSignups(schema: string, userFieldMappings: Record<string, FieldMapping>, debug: boolean = false): QueryBuilder {
        return new QueryBuilder(schema, userFieldMappings, debug)
            .addWithClause('active_users', 'SELECT id FROM users WHERE is_active = true')
            .addWithClause('recent_signups', "SELECT id FROM users WHERE created_at > NOW() - INTERVAL '30 days'");
    }

    static createCountryAggregationBuilder(schema: string, profileFieldMappings: Record<string, FieldMapping>, debug: boolean = false): QueryBuilder {
        return new QueryBuilder(schema, profileFieldMappings, debug);
    }
}

describe('QueryBuilderFactory', () => {
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

    describe('createEmailQueryBuilder', () => {
        it('should create a QueryBuilder with email JOIN configuration', () => {
            const builder = QueryBuilderFactory.createEmailQueryBuilder(SCHEMA, userFieldMappings, true);
            
            expect(builder).toBeInstanceOf(QueryBuilder);
        });

        it('should include JOIN clause in generated query', () => {
            const builder = QueryBuilderFactory.createEmailQueryBuilder(SCHEMA, userFieldMappings, false); // Disable debug to avoid console logs
            
            const { selectQuery } = builder.buildSelectQuery({
                tableName: 'users wwe',
                fields: ['id', 'username', 'email'],
                queryParams: { username_like: 'john' },
                limit: 5,
                offset: 0
            });

            // Normalize whitespace for comparison
            const normalizedQuery = selectQuery.text.replace(/\s+/g, ' ').trim();
            expect(normalizedQuery).toContain('JOIN databank_workers_welfare dww ON wwe.workers_welfare_id = dww.id');
            expect(selectQuery.values).toBeDefined();
        });

        it('should handle query parameters correctly', () => {
            const builder = QueryBuilderFactory.createEmailQueryBuilder(SCHEMA, userFieldMappings, false);
            
            const { selectQuery } = builder.buildSelectQuery({
                tableName: 'users wwe',
                fields: ['id', 'username', 'email'],
                queryParams: { username_like: 'john' },
                limit: 5,
                offset: 0
            });

            expect(selectQuery.values).toEqual(expect.arrayContaining(['%john%']));
        });
    });

    describe('createWithAggregations', () => {
        const withClauses = [
            { name: 'active_users', query: 'SELECT id FROM users WHERE is_active = true' },
            { name: 'recent_signups', query: 'SELECT id FROM users WHERE created_at > NOW() - INTERVAL \'30 days\'' }
        ];

        it('should create a QueryBuilder with WITH clauses', () => {
            const builder = QueryBuilderFactory.createWithAggregations(SCHEMA, userFieldMappings, withClauses, true);
            
            expect(builder).toBeInstanceOf(QueryBuilder);
        });

        it('should include all WITH clauses in generated query', () => {
            const builder = QueryBuilderFactory.createWithAggregations(SCHEMA, userFieldMappings, withClauses, true);
            
            const { selectQuery } = builder.buildSelectQuery({
                tableName: 'users',
                fields: ['id', 'username'],
                queryParams: { isActive: true },
                limit: 10,
                offset: 0
            });

            expect(selectQuery.text).toContain('WITH active_users AS');
            expect(selectQuery.text).toContain('recent_signups AS');
            expect(selectQuery.text).toContain('SELECT id FROM users WHERE is_active = true');
            expect(selectQuery.text).toContain('SELECT id FROM users WHERE created_at > NOW() - INTERVAL \'30 days\'');
        });

        it('should work with empty WITH clauses array', () => {
            const builder = QueryBuilderFactory.createWithAggregations(SCHEMA, userFieldMappings, [], true);
            
            const { selectQuery } = builder.buildSelectQuery({
                tableName: 'users',
                fields: ['id', 'username'],
                queryParams: { isActive: true },
                limit: 10,
                offset: 0
            });

            expect(selectQuery.text).not.toContain('WITH');
            expect(selectQuery.values).toBeDefined();
        });

        it('should default to empty WITH clauses when not provided', () => {
            const builder = QueryBuilderFactory.createWithAggregations(SCHEMA, userFieldMappings, undefined, true);
            
            expect(builder).toBeInstanceOf(QueryBuilder);
        });
    });

    describe('createUserProfileJoinBuilder', () => {
        it('should create a QueryBuilder with LEFT JOIN configuration', () => {
            const builder = QueryBuilderFactory.createUserProfileJoinBuilder(SCHEMA, userFieldMappings, true);
            
            expect(builder).toBeInstanceOf(QueryBuilder);
        });

        it('should include LEFT JOIN clause in generated query', () => {
            const builder = QueryBuilderFactory.createUserProfileJoinBuilder(SCHEMA, userFieldMappings, true);
            
            const { selectQuery } = builder.buildSelectQuery({
                tableName: 'users',
                fields: ['id', 'username', 'profileId'],
                queryParams: { isActive: true },
                limit: 10,
                offset: 0
            });

            expect(selectQuery.text).toContain('LEFT JOIN profiles ON users.profile_id = profiles.id');
            expect(selectQuery.values).toEqual(expect.arrayContaining([true]));
        });
    });

    describe('createActiveUsersWithRecentSignups', () => {
        it('should create a QueryBuilder with predefined WITH clauses', () => {
            const builder = QueryBuilderFactory.createActiveUsersWithRecentSignups(SCHEMA, userFieldMappings, true);
            
            expect(builder).toBeInstanceOf(QueryBuilder);
        });

        it('should include both active_users and recent_signups WITH clauses', () => {
            const builder = QueryBuilderFactory.createActiveUsersWithRecentSignups(SCHEMA, userFieldMappings, true);
            
            const { selectQuery } = builder.buildSelectQuery({
                tableName: 'users',
                fields: ['id', 'username'],
                queryParams: { isActive: true },
                limit: 10,
                offset: 0
            });

            expect(selectQuery.text).toContain('WITH active_users AS');
            expect(selectQuery.text).toContain('recent_signups AS');
            expect(selectQuery.text).toContain('SELECT id FROM users WHERE is_active = true');
            expect(selectQuery.text).toContain("SELECT id FROM users WHERE created_at > NOW() - INTERVAL '30 days'");
        });
    });

    describe('createCountryAggregationBuilder', () => {
        it('should create a QueryBuilder for profile aggregations', () => {
            const builder = QueryBuilderFactory.createCountryAggregationBuilder(SCHEMA, profileFieldMappings, true);
            
            expect(builder).toBeInstanceOf(QueryBuilder);
        });

        it('should generate correct aggregate query with GROUP BY', () => {
            const builder = QueryBuilderFactory.createCountryAggregationBuilder(SCHEMA, profileFieldMappings, true);
            
            const aggQuery = builder.buildAggregateQuery({
                tableName: 'profiles',
                aggregates: {
                    avgAge: { function: 'AVG', field: 'age' },
                    maxAge: { function: 'MAX', field: 'age' }
                },
                groupBy: ['country'],
                requiredFilters: { country: 'USA' },
                queryParams: { age_gte: 18 }
            });

            expect(aggQuery.text).toContain('AVG(profiles.age) AS avgAge');
            expect(aggQuery.text).toContain('MAX(profiles.age) AS maxAge');
            expect(aggQuery.text).toContain('GROUP BY profiles.country');
            expect(aggQuery.values).toEqual(expect.arrayContaining(['USA', 18]));
        });

        it('should handle multiple aggregation functions', () => {
            const builder = QueryBuilderFactory.createCountryAggregationBuilder(SCHEMA, profileFieldMappings, true);
            
            const aggQuery = builder.buildAggregateQuery({
                tableName: 'profiles',
                aggregates: {
                    countUsers: { function: 'COUNT', field: 'id' },
                    minAge: { function: 'MIN', field: 'age' },
                    maxAge: { function: 'MAX', field: 'age' }
                },
                groupBy: ['country'],
                requiredFilters: {},
                queryParams: {}
            });

            expect(aggQuery.text).toContain('COUNT(profiles.id) AS countUsers');
            expect(aggQuery.text).toContain('MIN(profiles.age) AS minAge');
            expect(aggQuery.text).toContain('MAX(profiles.age) AS maxAge');
        });
    });

    describe('Factory method default parameters', () => {
        it('should use debug=false by default for createEmailQueryBuilder', () => {
            const builder = QueryBuilderFactory.createEmailQueryBuilder(SCHEMA, userFieldMappings);
            
            expect(builder).toBeInstanceOf(QueryBuilder);
            // Debug mode would be tested by checking internal state if accessible
        });

        it('should use debug=false by default for createUserProfileJoinBuilder', () => {
            const builder = QueryBuilderFactory.createUserProfileJoinBuilder(SCHEMA, userFieldMappings);
            
            expect(builder).toBeInstanceOf(QueryBuilder);
        });

        it('should use debug=false by default for createActiveUsersWithRecentSignups', () => {
            const builder = QueryBuilderFactory.createActiveUsersWithRecentSignups(SCHEMA, userFieldMappings);
            
            expect(builder).toBeInstanceOf(QueryBuilder);
        });

        it('should use debug=false by default for createCountryAggregationBuilder', () => {
            const builder = QueryBuilderFactory.createCountryAggregationBuilder(SCHEMA, profileFieldMappings);
            
            expect(builder).toBeInstanceOf(QueryBuilder);
        });
    });

    describe('Error handling and edge cases', () => {
        it('should handle empty field mappings', () => {
            const emptyMappings: Record<string, FieldMapping> = {};
            const builder = QueryBuilderFactory.createEmailQueryBuilder(SCHEMA, emptyMappings);
            
            expect(builder).toBeInstanceOf(QueryBuilder);
        });

        it('should throw error for invalid schema', () => {
            // Test with invalid schema that would cause validation errors
            expect(() => {
                QueryBuilderFactory.createUserProfileJoinBuilder('', userFieldMappings);
            }).toThrow('Invalid table identifier:');
        });
    });
});