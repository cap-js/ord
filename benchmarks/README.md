# Parallel Build Benchmark

Benchmark framework for evaluating worker-thread parallelization of CDS resource file compilation during `cds build --for ord`.

Related: [#363](https://github.com/cap-js/ord/issues/363) - Performance: Parallelize resource file generation for large models

## Background

The ORD build compiles each service's resource definitions (OpenAPI, EDMX, CSN, AsyncAPI, GraphQL) sequentially. For large enterprise projects (29+ services), this takes ~301 seconds. Since each compilation is CPU-bound and independent, worker threads can parallelize the work.

## Quick Start

```bash
# Lightweight mode (uses xmpl project, ~10s)
node benchmarks/run.js

# Enterprise simulation (~3.5s per task, matching issue #363 data, ~4-5 min)
node benchmarks/run.js --enterprise

# Custom options
node benchmarks/run.js --pool 2,4,8,16    # specific pool sizes
node benchmarks/run.js --tasks 50          # specific task count
node benchmarks/run.js --enterprise --pool 4,8 --tasks 87
```

## Architecture

```
benchmarks/
  run.js              - Main benchmark script (CLI entry point)
  compile-worker.js   - Worker thread: receives URL, compiles, returns result
  worker-pool.js      - Minimal worker pool (zero dependencies, ~70 lines)
```

**Key design decisions:**

- **`workerData`** passes the CDS model once per worker at creation, not per task
- **JSON roundtrip** on worker responses (CDS compiler output contains Generator objects that fail structured clone)
- **No external dependencies** - pool uses built-in `worker_threads`

## Results

### Lightweight Mode (xmpl project, 14 tasks)

| Workers    | Time  | Speedup | Efficiency |
| ---------- | ----- | ------- | ---------- |
| Sequential | 1.20s | 1.00x   | -          |
| 2          | 0.45s | 2.66x   | 133%       |
| 4          | 0.29s | 4.07x   | 102%       |
| 8          | 0.24s | 4.94x   | 62%        |

### Enterprise Simulation (87 tasks, ~3.5s/task)

Simulates the scale reported in issue #363 (29 services, 301s sequential).

| Workers       | Time   | Speedup | Estimated (301s ->) |
| ------------- | ------ | ------- | ------------------- |
| Sequential    | 229.5s | 1.00x   | 301s                |
| 2             | 114.9s | 2.00x   | 151s                |
| 4             | 57.6s  | 3.99x   | 75s                 |
| 8             | 30.7s  | 7.47x   | 40s                 |
| 20 (all CPUs) | 14.1s  | 16.28x  | 18s                 |

### Key Findings

1. **Near-linear scaling** - 4 workers = ~4x speedup, 8 workers = ~7.5x
2. **All protocols work** - OData (oas3/edmx), CSN, AsyncAPI, GraphQL all compile correctly in worker threads
3. **No threshold needed** - Even 14 tasks benefit from parallelization
4. **Model serialization** - CDS model must be JSON-roundtripped before passing to workers (contains Generator objects incompatible with structured clone)
5. **`workerData` vs `exec()`** - Model should be passed once at worker creation via `workerData`, not serialized per task via `exec()`

### Recommended Default

```js
const os = require("os");
const poolSize = Math.min(os.availableParallelism(), totalTasks);
```

This saturates available CPUs while avoiding unnecessary workers. Build is a short-lived operation where full CPU utilization is acceptable.
