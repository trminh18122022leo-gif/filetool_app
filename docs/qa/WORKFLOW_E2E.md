# FileTools Pro — Workflow Studio & Workspace E2E Test Specification
**Document Version:** 1.0.0 (Phase 07 — Durable Workflow Orchestration)  
**Standard:** Automated Multi-Tenant Integration QA / Zero-Leak Verification  
**Execution:** Native Node.js Test Runner (`tests/integration/workflow-workspace.test.js`)

---

## 1. E2E Test Suite Matrix

| Suite # | Test Scenario | Threat / Failure Vector | Expected Assertion |
|:---:|---|---|---|
| **1.1** | **DAG Cycle Detection** | Malicious or accidental cyclic edges ($A \rightarrow B \rightarrow C \rightarrow A$) | Throws `DAG_CYCLE_DETECTED`; rejects graph execution with HTTP 400. |
| **1.2** | **Disallowed Operator Injection** | Attacker injects `{ operator: "shell_exec", command: "rm -rf /" }` | Throws `DISALLOWED_OPERATOR`; execution immediately halted. |
| **1.3** | **Complexity Bounds** | Graph with $>15$ nodes or depth $>8$ | Throws `DAG_COMPLEXITY_EXCEEDED`. |
| **2.1** | **Multi-Tenant Run Isolation** | User B attempts `GET /api/workflows/run/:runId` of User A's run | Returns HTTP 403 `FORBIDDEN_WORKFLOW_ACCESS`. |
| **2.2** | **Multi-Tenant Cancellation Defense** | User B attempts `POST /api/workflows/run/:runId/cancel` on User A's run | Returns HTTP 403 `FORBIDDEN_WORKFLOW_ACCESS`. |
| **3.1** | **Idempotent Replay Prevention** | Client retries duplicate `POST /api/workflows/run` with same `idempotencyKey` | Returns existing run record; quota reserved exactly once. |
| **3.2** | **Atomic Quota Refund on Cancellation** | User cancels running workflow with 3 reserved units | Quota service increments available units by 3 (atomic refund). |
| **4.1** | **Sandbox Directory Isolation & Cleanup** | Workflow execution creates intermediate files in sandbox | Sandbox directory `uploads/sandbox/run_{id}` is purged on complete/fail. |
| **5.1** | **My Files Workspace Pagination & Tenant Filter** | User A queries `/api/storage/files` | Only returns User A's files; User B's files never leak into query. |
| **5.2** | **Soft Delete & Restore Lifecycle** | File moved to trash and restored | `isSoftDeleted` toggles appropriately; excluded from normal listing. |

---

## 2. Automated Test Execution Commands

```bash
# Run Workflow Studio & Workspace Integration Suite
node --test tests/integration/workflow-workspace.test.js

# Run Complete System Regression Suite (70+ Tests)
npm run test:all
```
