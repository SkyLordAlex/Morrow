---
name: OpenAPI numeric schema compatibility
description: Compatibility constraint between the workspace OpenAPI generator and its installed Zod validator.
---

When adding numeric fields to the OpenAPI contract, prefer `type: number` for values that are represented as numbers in the API unless the generated validator package has been upgraded to a Zod version supporting `z.int()`.

**Why:** The current generator emits `z.int()` for OpenAPI `integer`, while the workspace's API validator dependency resolves to Zod 3, which does not expose that helper. Codegen succeeds but the chained library typecheck fails.

**How to apply:** If integer semantics matter, enforce them in the server route or upgrade the validator and regenerate all clients together. Otherwise use `number` in the shared contract.