import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

type TimestampSqlInput = string | SQLWrapper;

export const sqliteTimestampText = (value: TimestampSqlInput): SQL<string> => {
  const source = sql`${value}`;
  return sql<string>`CASE
    WHEN substr(${source}, -5, 1) IN ('+', '-')
      AND substr(${source}, -4, 4) GLOB '[0-9][0-9][0-9][0-9]'
    THEN substr(${source}, 1, length(${source}) - 2)
      || ':' || substr(${source}, -2, 2)
    ELSE ${source}
  END`;
};

export const sqliteJulianDay = (
  value: TimestampSqlInput,
  modifier?: TimestampSqlInput,
): SQL<number> => modifier === undefined
  ? sql<number>`julianday(${sqliteTimestampText(value)})`
  : sql<number>`julianday(${sqliteTimestampText(value)}, ${modifier})`;
