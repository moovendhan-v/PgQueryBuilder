# QueryBuilder

A flexible, modular, and type-safe SQL query builder for Node.js/TypeScript projects, designed for PostgreSQL and advanced filtering, aggregation, and pagination use cases.

## Features
- Type-safe field mapping and validation
- Dynamic filter and sort support
- Advanced filter operations (LIKE, IN, BETWEEN, JSONB, array, full-text search, etc.)
- Aggregation and group by
- Pagination utilities
- Response mapping (snake_case to camelCase)
- Extensible factory for custom query patterns

## Installation

```
npm install
```

## Usage

### 1. Basic QueryBuilder Example
```ts
import { QueryBuilder, FieldMapping } from './src/QueryBuilder';

const userFieldMappings: Record<string, FieldMapping> = {
  id: { dbField: 'users.id', type: 'uuid' },
  username: { dbField: 'users.username', type: 'string' },
  email: { dbField: 'users.email', type: 'string' },
  isActive: { dbField: 'users.is_active', type: 'boolean' },
  createdAt: { dbField: 'users.created_at', type: 'timestamp' }
};

const builder = new QueryBuilder('public', userFieldMappings);
const { selectQuery } = builder.buildSelectQuery({
  tableName: 'users',
  fields: ['id', 'username', 'email'],
  queryParams: { isActive: true, username_like: 'john' },
  limit: 10,
  offset: 0
});
console.log(selectQuery.text, selectQuery.values);
```

### 2. Using QueryBuilderFactory
```ts
import { QueryBuilderFactory } from './test/factory.test'; // or your own factory location

const builder = QueryBuilderFactory.createUserProfileJoinBuilder('public', userFieldMappings);
const { selectQuery } = builder.buildSelectQuery({
  tableName: 'users',
  fields: ['id', 'username', 'profileId'],
  queryParams: { isActive: true },
  limit: 10,
  offset: 0
});
console.log(selectQuery.text);
```

### 3. Running Tests

To run all test files recursively:

```
npm test
```

### 3. Run cid locally

To run all cicd locally before commiting to github:

```
act push -j build --container-architecture linux/amd64

# Simulate push
act push

# Simulate PR
act pull_request

# Simulate a specific job
act -j lint
```

## Contribution

1. Fork the repo and create your feature branch (`git checkout -b feature/my-feature`)
2. Commit your changes (`git commit -am 'Add new feature'`)
3. Push to the branch (`git push origin feature/my-feature`)
4. Create a new Pull Request

## License

MIT 