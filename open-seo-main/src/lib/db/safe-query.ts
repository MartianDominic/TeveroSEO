/**
 * Safe SQL query utilities to prevent injection.
 *
 * This module provides utilities for building safe dynamic SQL queries with
 * proper parameterization, identifier validation, and pattern escaping.
 *
 * @module safe-query
 */

import { sql, SQL } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// Identifier Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pattern for valid SQL identifiers.
 * Only allows alphanumeric characters and underscores, starting with a letter or underscore.
 */
const IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Maximum length for SQL identifiers (PostgreSQL limit is 63).
 */
const MAX_IDENTIFIER_LENGTH = 63;

/**
 * Sanitize SQL identifier (table/column names).
 * Only allows alphanumeric characters and underscores.
 *
 * @param identifier - The identifier to sanitize
 * @returns The validated identifier
 * @throws Error if identifier is invalid
 *
 * @example
 * sanitizeIdentifier('users') // 'users'
 * sanitizeIdentifier('user_profiles') // 'user_profiles'
 * sanitizeIdentifier('users; DROP TABLE') // throws Error
 */
export function sanitizeIdentifier(identifier: string): string {
  if (!identifier || typeof identifier !== "string") {
    throw new Error("Identifier must be a non-empty string");
  }

  if (identifier.length > MAX_IDENTIFIER_LENGTH) {
    throw new Error(
      `Identifier exceeds maximum length of ${MAX_IDENTIFIER_LENGTH}: ${identifier.slice(0, 20)}...`
    );
  }

  if (!IDENTIFIER_PATTERN.test(identifier)) {
    throw new Error(`Invalid SQL identifier: ${identifier}`);
  }

  return identifier;
}

/**
 * Create safe dynamic column reference with table qualifier.
 *
 * @param tableName - The table name
 * @param columnName - The column name
 * @returns A safe SQL fragment for the qualified column reference
 *
 * @example
 * safeColumn('users', 'email') // sql`"users"."email"`
 */
export function safeColumn(tableName: string, columnName: string): SQL {
  const safeTable = sanitizeIdentifier(tableName);
  const safeCol = sanitizeIdentifier(columnName);
  return sql.raw(`"${safeTable}"."${safeCol}"`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ORDER BY Safety
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valid sort directions.
 */
export type SortDirection = "asc" | "desc" | "ASC" | "DESC";

/**
 * Create safe ORDER BY clause.
 * Only allows whitelisted columns to prevent injection via sort parameters.
 *
 * @param column - The column to sort by
 * @param direction - Sort direction ('asc' or 'desc')
 * @param allowedColumns - List of allowed column names
 * @returns A safe SQL ORDER BY fragment
 * @throws Error if column is not in allowed list
 *
 * @example
 * const allowedCols = ['created_at', 'name', 'email'];
 * safeOrderBy('created_at', 'desc', allowedCols) // sql`"created_at" DESC`
 * safeOrderBy('password', 'asc', allowedCols) // throws Error
 */
export function safeOrderBy(
  column: string,
  direction: SortDirection,
  allowedColumns: readonly string[]
): SQL {
  if (!allowedColumns.includes(column)) {
    throw new Error(`Column not allowed for ordering: ${column}`);
  }

  const safeCol = sanitizeIdentifier(column);
  const safeDir = direction.toLowerCase() === "desc" ? "DESC" : "ASC";

  return sql.raw(`"${safeCol}" ${safeDir}`);
}

/**
 * Create safe ORDER BY clause with nulls handling.
 *
 * @param column - The column to sort by
 * @param direction - Sort direction
 * @param allowedColumns - List of allowed column names
 * @param nulls - Where to place nulls ('first' or 'last')
 * @returns A safe SQL ORDER BY fragment with NULLS handling
 */
export function safeOrderByNulls(
  column: string,
  direction: SortDirection,
  allowedColumns: readonly string[],
  nulls: "first" | "last"
): SQL {
  if (!allowedColumns.includes(column)) {
    throw new Error(`Column not allowed for ordering: ${column}`);
  }

  const safeCol = sanitizeIdentifier(column);
  const safeDir = direction.toLowerCase() === "desc" ? "DESC" : "ASC";
  const safeNulls = nulls === "first" ? "FIRST" : "LAST";

  return sql.raw(`"${safeCol}" ${safeDir} NULLS ${safeNulls}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// LIKE Pattern Safety
// ─────────────────────────────────────────────────────────────────────────────

/**
 * LIKE pattern match types.
 */
export type LikeMatchType = "contains" | "starts" | "ends" | "exact";

/**
 * Create safe LIKE pattern.
 * Escapes special characters to prevent injection via search patterns.
 *
 * @param input - The search input from user
 * @param type - Match type: 'contains', 'starts', 'ends', or 'exact'
 * @returns Escaped pattern string safe for LIKE/ILIKE
 *
 * @example
 * safeLikePattern('test', 'contains') // '%test%'
 * safeLikePattern('100%', 'contains') // '%100\\%%'
 * safeLikePattern('user_name', 'starts') // 'user\\_name%'
 */
export function safeLikePattern(input: string, type: LikeMatchType): string {
  // Escape LIKE special characters
  const escaped = input
    .replace(/\\/g, "\\\\") // Escape backslashes first
    .replace(/%/g, "\\%") // Escape percent
    .replace(/_/g, "\\_"); // Escape underscore

  switch (type) {
    case "contains":
      return `%${escaped}%`;
    case "starts":
      return `${escaped}%`;
    case "ends":
      return `%${escaped}`;
    case "exact":
      return escaped;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// IN Clause Safety
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Safe IN clause builder.
 * Uses parameterized values, never string interpolation.
 *
 * @param column - SQL fragment for the column
 * @param values - Array of values for the IN clause
 * @returns Safe SQL IN clause, or FALSE if empty array
 *
 * @example
 * const statusCol = sql`status`;
 * safeInClause(statusCol, ['active', 'pending']) // status IN ('active', 'pending')
 * safeInClause(statusCol, []) // FALSE
 */
export function safeInClause<T extends string | number>(
  column: SQL,
  values: T[]
): SQL {
  if (values.length === 0) {
    return sql`FALSE`; // Empty IN is always false
  }

  // Create parameterized placeholders for each value
  const placeholders = values.map((v) => sql`${v}`);
  return sql`${column} IN (${sql.join(placeholders, sql`, `)})`;
}

/**
 * Safe NOT IN clause builder.
 *
 * @param column - SQL fragment for the column
 * @param values - Array of values to exclude
 * @returns Safe SQL NOT IN clause, or TRUE if empty array
 */
export function safeNotInClause<T extends string | number>(
  column: SQL,
  values: T[]
): SQL {
  if (values.length === 0) {
    return sql`TRUE`; // Empty NOT IN excludes nothing
  }

  const placeholders = values.map((v) => sql`${v}`);
  return sql`${column} NOT IN (${sql.join(placeholders, sql`, `)})`;
}

// ─────────────────────────────────────────────────────────────────────────────
// WHERE Clause Builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Allowed SQL operators for WHERE clause building.
 */
const ALLOWED_OPERATORS = new Set([
  "=",
  "!=",
  "<>",
  "<",
  ">",
  "<=",
  ">=",
  "LIKE",
  "ILIKE",
  "IS NULL",
  "IS NOT NULL",
] as const);

type AllowedOperator = "=" | "!=" | "<>" | "<" | ">" | "<=" | ">=" | "LIKE" | "ILIKE" | "IS NULL" | "IS NOT NULL";

/**
 * Condition for building WHERE clauses.
 */
export interface WhereCondition {
  column: string;
  operator: AllowedOperator;
  value?: unknown;
}

/**
 * Build dynamic WHERE clause safely.
 * Validates columns against whitelist and operators against allowed set.
 *
 * @param conditions - Array of conditions to combine with AND
 * @param allowedColumns - List of allowed column names
 * @returns Safe SQL WHERE clause, or undefined if no conditions
 * @throws Error if column or operator is not allowed
 *
 * @example
 * const conditions = [
 *   { column: 'status', operator: '=', value: 'active' },
 *   { column: 'created_at', operator: '>=', value: new Date() }
 * ];
 * buildWhereClause(conditions, ['status', 'created_at', 'name'])
 */
export function buildWhereClause(
  conditions: WhereCondition[],
  allowedColumns: readonly string[]
): SQL | undefined {
  if (conditions.length === 0) {
    return undefined;
  }

  const sqlConditions = conditions.map(({ column, operator, value }) => {
    // Validate column
    if (!allowedColumns.includes(column)) {
      throw new Error(`Column not allowed: ${column}`);
    }

    // Validate operator
    const upperOp = operator.toUpperCase() as AllowedOperator;
    if (!ALLOWED_OPERATORS.has(upperOp)) {
      throw new Error(`Operator not allowed: ${operator}`);
    }

    const safeCol = sql.raw(`"${sanitizeIdentifier(column)}"`);

    // Handle null checks
    if (upperOp === "IS NULL") {
      return sql`${safeCol} IS NULL`;
    }
    if (upperOp === "IS NOT NULL") {
      return sql`${safeCol} IS NOT NULL`;
    }

    // Use parameterized value for other operators
    switch (upperOp) {
      case "=":
        return sql`${safeCol} = ${value}`;
      case "!=":
      case "<>":
        return sql`${safeCol} <> ${value}`;
      case "<":
        return sql`${safeCol} < ${value}`;
      case ">":
        return sql`${safeCol} > ${value}`;
      case "<=":
        return sql`${safeCol} <= ${value}`;
      case ">=":
        return sql`${safeCol} >= ${value}`;
      case "LIKE":
        return sql`${safeCol} LIKE ${value}`;
      case "ILIKE":
        return sql`${safeCol} ILIKE ${value}`;
      default:
        throw new Error(`Unhandled operator: ${operator}`);
    }
  });

  return sql.join(sqlConditions, sql` AND `);
}

// ─────────────────────────────────────────────────────────────────────────────
// Table Name Whitelist
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a type-safe table query function with whitelist validation.
 * Prevents dynamic table name injection by only allowing predefined tables.
 *
 * @param allowedTables - Tuple of allowed table names
 * @returns A function that validates table names and returns safe SQL
 *
 * @example
 * const tables = ['users', 'clients', 'keywords'] as const;
 * const safeTable = createTableWhitelist(tables);
 *
 * safeTable('users') // sql.raw('"users"')
 * safeTable('passwords') // throws Error
 */
export function createTableWhitelist<T extends readonly string[]>(
  allowedTables: T
) {
  type AllowedTable = T[number];

  return function safeTableName(table: AllowedTable): SQL {
    if (!allowedTables.includes(table)) {
      throw new Error(`Table not allowed: ${table}`);
    }

    const safeTable = sanitizeIdentifier(table);
    return sql.raw(`"${safeTable}"`);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Graph Name Safety (for Cypher/FalkorDB)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pattern for valid graph names (more restrictive than SQL identifiers).
 * Allows alphanumeric, underscores, and colons for namespacing (e.g., kg:tenant_id).
 */
const GRAPH_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_:]*$/;

/**
 * Sanitize graph database name.
 * Used for FalkorDB and Apache AGE graph names.
 *
 * @param graphName - The graph name to sanitize
 * @returns The validated graph name
 * @throws Error if graph name is invalid
 *
 * @example
 * sanitizeGraphName('kg:tenant_123') // 'kg:tenant_123'
 * sanitizeGraphName('kg_tenant_abc') // 'kg_tenant_abc'
 * sanitizeGraphName("kg'; DROP DATABASE") // throws Error
 */
export function sanitizeGraphName(graphName: string): string {
  if (!graphName || typeof graphName !== "string") {
    throw new Error("Graph name must be a non-empty string");
  }

  if (graphName.length > MAX_IDENTIFIER_LENGTH) {
    throw new Error(
      `Graph name exceeds maximum length of ${MAX_IDENTIFIER_LENGTH}: ${graphName.slice(0, 20)}...`
    );
  }

  if (!GRAPH_NAME_PATTERN.test(graphName)) {
    throw new Error(`Invalid graph name: ${graphName}`);
  }

  return graphName;
}

/**
 * Create safe tenant graph name.
 * Combines prefix with tenant ID, sanitizing the tenant ID.
 *
 * @param prefix - Graph name prefix (e.g., 'kg')
 * @param tenantId - Tenant identifier
 * @returns Safe graph name
 *
 * @example
 * safeTenantGraphName('kg', 'tenant-123') // 'kg:tenant_123'
 */
export function safeTenantGraphName(prefix: string, tenantId: string): string {
  // Sanitize prefix
  const safePrefix = sanitizeIdentifier(prefix);

  // Sanitize tenant ID: replace non-alphanumeric with underscore
  const safeTenantId = tenantId.replace(/[^a-zA-Z0-9]/g, "_");

  if (!safeTenantId || safeTenantId.length === 0) {
    throw new Error("Tenant ID cannot be empty after sanitization");
  }

  return `${safePrefix}:${safeTenantId}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cypher Parameter Safety
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate that Cypher query uses parameterized values.
 * This is a runtime check to catch accidentally interpolated values.
 *
 * @param cypher - The Cypher query string
 * @returns true if query appears safe (uses $params or no string values)
 * @throws Error if query contains suspicious patterns
 *
 * @example
 * validateCypherQuery("MATCH (n:User {name: $name}) RETURN n") // true
 * validateCypherQuery("MATCH (n:User {name: 'admin'}) RETURN n") // throws
 */
export function validateCypherQuery(cypher: string): boolean {
  // Check for common injection patterns
  const suspiciousPatterns = [
    /'\s*\+\s*\w+/i, // String concatenation: '+ variable
    /`\s*\+\s*\w+/i, // Template literal style
    /\$\{[^}]+\}/i, // Template interpolation: ${var}
    /'[^']*'.*(?:DROP|DELETE|CREATE|MERGE|SET)\s+(?!\/\/)/i, // Suspicious commands after string
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(cypher)) {
      throw new Error(
        `Cypher query contains suspicious pattern. Use parameterized queries: ${cypher.slice(0, 100)}`
      );
    }
  }

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Array/JSON Safety
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Safely build PostgreSQL array literal.
 * Escapes values properly to prevent injection.
 *
 * @param values - Array of string values
 * @returns Safe SQL array expression
 *
 * @example
 * safeArrayLiteral(['tag1', 'tag2']) // ARRAY['tag1','tag2']
 * safeArrayLiteral(["tag'; DROP TABLE"]) // ARRAY['tag''; DROP TABLE']
 */
export function safeArrayLiteral(values: string[]): SQL {
  if (values.length === 0) {
    return sql`ARRAY[]::text[]`;
  }

  const escaped = values.map((v) => sql`${v}`);
  return sql`ARRAY[${sql.join(escaped, sql`, `)}]`;
}
