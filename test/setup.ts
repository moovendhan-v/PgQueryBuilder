// test/setup.ts
// Jest setup file for global test configuration

// Suppress console.log in tests to reduce noise
// Uncomment the line below if you want to suppress debug logs during testing
// console.log = jest.fn();

// Global test utilities
declare global {
    namespace jest {
      interface Matchers<R> {
        toBeValidSQL(): R;
        toContainSQLClause(clause: string): R;
      }
    }
  }
  
  // Custom Jest matchers
  expect.extend({
    toBeValidSQL(received: string) {
      const isValid = received.trim().length > 0 && 
                     (received.includes('SELECT') || 
                      received.includes('INSERT') || 
                      received.includes('UPDATE') || 
                      received.includes('DELETE'));
      
      if (isValid) {
        return {
          message: () => `expected ${received} not to be valid SQL`,
          pass: true,
        };
      } else {
        return {
          message: () => `expected ${received} to be valid SQL`,
          pass: false,
        };
      }
    },
    
    toContainSQLClause(received: string, clause: string) {
      const normalizedReceived = received.replace(/\s+/g, ' ').trim().toLowerCase();
      const normalizedClause = clause.replace(/\s+/g, ' ').trim().toLowerCase();
      const contains = normalizedReceived.includes(normalizedClause);
      
      if (contains) {
        return {
          message: () => `expected ${received} not to contain SQL clause ${clause}`,
          pass: true,
        };
      } else {
        return {
          message: () => `expected ${received} to contain SQL clause ${clause}`,
          pass: false,
        };
      }
    }
  });
  
  // Utility functions available in all tests
  export function normalizeSql(sql: string): string {
    return sql
      .replace(/\s+/g, ' ')  // Replace multiple whitespace with single space
      .trim()                // Remove leading/trailing whitespace
      .replace(/\n/g, ' ');  // Replace newlines with spaces
  }
  
  export function extractSQLClauses(sql: string) {
    const normalized = normalizeSql(sql);
    
    return {
      select: normalized.match(/SELECT\s+([^F]+)FROM/i)?.[1]?.trim(),
      from: normalized.match(/FROM\s+([^W]+)(?:WHERE|ORDER|GROUP|LIMIT|$)/i)?.[1]?.trim(),
      where: normalized.match(/WHERE\s+([^O]+)(?:ORDER|GROUP|LIMIT|$)/i)?.[1]?.trim(),
      orderBy: normalized.match(/ORDER BY\s+([^L]+)(?:LIMIT|$)/i)?.[1]?.trim(),
      limit: normalized.match(/LIMIT\s+(\d+)/i)?.[1]?.trim(),
      offset: normalized.match(/OFFSET\s+(\d+)/i)?.[1]?.trim()
    };
  }
  
  // Mock console methods if needed
  export const mockConsole = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
  };
  
  // Set longer timeout for database-related tests
  jest.setTimeout(30000);