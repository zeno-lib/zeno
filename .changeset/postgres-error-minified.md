---
"@zeno-lib/db": patch
---

Constraint violations are recognised in minified production builds.
`toPostgresError` matched the postgres.js error by its `name`, which postgres.js
takes from the class name, and a minifier renames the class (to `"a"`, say). So
in a production server bundle `toPostgresError` returned `undefined`, and
`isConstraintViolation` never matched: a unique violation you map to a friendly
message fell through to a generic error, in production only. An error now counts
when its `code` is a SQLSTATE and it carries the severity Postgres sends with
every error. A Node system error (`EPIPE`) or an error postgres.js raises itself
(`CONNECTION_CLOSED`) still doesn't match.
