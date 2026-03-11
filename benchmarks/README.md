# Parallel Build Benchmark

Benchmark framework for evaluating worker-thread parallelization of CDS resource file compilation during `cds build --for ord`.

Related: [#363](https://github.com/cap-js/ord/issues/363) - Performance: Parallelize resource file generation for large models

## Background

The ORD build compiles each service's resource definitions (OpenAPI, EDMX, CSN, AsyncAPI, GraphQL) sequentially. For large enterprise projects (29+ services), this takes **~260-300 seconds**. Since each compilation is CPU-bound and independent, worker threads can parallelize the work.

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

### 1. Real Enterprise Project (\*-srv)

> 29 API resources, 58 tasks (oas3 + edmx), 10 MB CSN model, ~4s per compilation

```
Sequential:  228s  ████████████████████████████████████████████████████████████ 1.0x
 2 workers:   98s  █████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 2.3x
 4 workers:   57s  ███████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 4.0x
 8 workers:   52s  █████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 4.4x
20 workers:   54s  ██████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 4.2x
                   |         |         |         |         |         |
                   0s       50s      100s      150s      200s      250s
```

| Workers       | Time   | Speedup | Build time reduction |
| ------------- | ------ | ------- | -------------------- |
| Sequential    | 227.9s | 1.00x   | -                    |
| 2             | 97.9s  | 2.33x   | -130s (57%)          |
| 4             | 57.4s  | 3.97x   | -171s (75%)          |
| **8**         | 51.5s  | 4.42x   | **-176s (77%)**      |
| 20 (all CPUs) | 54.0s  | 4.22x   | -174s (76%)          |

**Observation:** Scaling plateaus at ~8 workers for large models. 20 workers is slightly _slower_ than 8 due to worker creation overhead (10 MB model x 20 = 200 MB transferred via structured clone) and task starvation (58 tasks / 20 workers = only ~3 tasks per worker).

### 2. Real Enterprise Project — OAS3 Only (\*-srv)

> Isolating the heaviest compilation type. 29 OAS3 tasks, ~4s each.

```
Sequential:  115s  ████████████████████████████████████████████████████████████ 1.0x
 4 workers:   31s  ████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 3.7x
 8 workers:   23s  ███████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 5.1x
                   |         |         |         |         |         |
                   0s       25s       50s       75s      100s      125s
```

### 3. Enterprise Simulation (xmpl project + CPU burn)

> Small model (<1 MB), 68 tasks padded to ~3.5s/task to match issue #363 timing.

```
Sequential:  230s  ████████████████████████████████████████████████████████████ 1.0x
 2 workers:  115s  ██████████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 2.0x
 4 workers:   58s  ███████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 4.0x
 8 workers:   31s  ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 7.5x
20 workers:   14s  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 16.3x
                   |         |         |         |         |         |
                   0s       50s      100s      150s      200s      250s
```

| Workers       | Time   | Speedup | Efficiency |
| ------------- | ------ | ------- | ---------- |
| Sequential    | 229.5s | 1.00x   | -          |
| 2             | 114.9s | 2.00x   | 100%       |
| 4             | 57.6s  | 3.99x   | 100%       |
| 8             | 30.7s  | 7.47x   | 93%        |
| 20 (all CPUs) | 14.1s  | 16.28x  | 81%        |

**Key contrast with real project:** With a small model, scaling continues to improve beyond 8 workers because model transfer overhead is negligible. With a 10 MB model, the overhead limits practical scaling.

### 4. Lightweight Mode (xmpl project, all protocols)

> 14 tasks: 4 services x (oas3 + edmx + csn) + AsyncAPI + GraphQL

| Workers    | Time  | Speedup |
| ---------- | ----- | ------- |
| Sequential | 1.20s | 1.00x   |
| 2          | 0.45s | 2.66x   |
| 4          | 0.29s | 4.07x   |
| 8          | 0.24s | 4.94x   |

All protocol types (OData/oas3, EDMX, CSN, AsyncAPI, GraphQL) compile correctly in worker threads.

## Overhead Analysis

Measured on \*-srv (10 MB CSN, 29 services):

```
Per-task breakdown:
  Compilation (oas3):     ~4500ms  ████████████████████████████████████████████████ 99.4%
  Model clone (workerData): 176ms  █                                                0.4%
  Response serialize:        26ms  ▏                                                0.1%
```

| Overhead                          | Time    | % of compile |
| --------------------------------- | ------- | ------------ |
| Single OAS3 compilation           | 4498 ms | -            |
| Model structured clone (10 MB)    | 176 ms  | 3.9%         |
| Response JSON roundtrip (3 MB)    | 26 ms   | 0.6%         |
| Worker creation (4 workers total) | ~700 ms | one-time     |
| Worker creation (20 workers)      | ~3500ms | one-time     |

### Worker writes to disk vs sending response back

Tested whether having workers write files directly (instead of sending response to main thread) improves performance:

| 4 workers | v1 (response back) | v2 (write in worker) | Difference |
| --------- | ------------------ | -------------------- | ---------- |
| OAS3 only | 30.7s              | 30.3s                | -1.3%      |
| 8 workers | 22.5s              | 22.2s                | -1.3%      |

**Verdict:** Negligible difference. Compilation dominates; response transfer is <1% of task time.

### 5. Over-provisioning: 2x CPUs is Counterproductive

> Tested with `threads=2C` (double the available CPUs) on the real enterprise project.

| Implementation        | Workers | Time    | Speedup        |
| --------------------- | ------- | ------- | -------------- |
| Sequential (baseline) | 1       | 282s    | 1.0x           |
| PR #378 (cpus/2)      | 10      | 45s     | 6.3x           |
| PR #376 with 0.5C     | 10      | 47s     | 6.0x           |
| **PR #376 with 2C**   | **40**  | **67s** | **4.2x**       |
| **PR #376 with 3C**   | **60**  | **OOM** | **crashed** 💥 |

**Result: 2C is 40% slower than 0.5C** (67s vs 47s), and **3C crashes with OOM** (`JavaScript heap out of memory`). With 60 workers each cloning a 10 MB model, total memory exceeds 600 MB, causing the Node.js heap to run out of memory.

## Key Findings

1. **4-8 workers is the sweet spot** for real enterprise projects with large models (10+ MB CSN)
2. **All protocols work** in worker threads: OData (oas3/edmx), CSN, AsyncAPI, GraphQL
3. **Model serialization matters at scale**: 10 MB model x 20 workers = 200 MB, causing diminishing returns beyond 8 workers
4. **CDS model contains Generator objects** that prevent direct `postMessage` — must JSON-roundtrip before passing via `workerData`
5. **`workerData` is essential**: Pass model once at worker creation, not per task via `exec()`
6. **No threshold needed**: Even small projects (14 tasks) benefit from parallelization
7. **Response transfer is not a bottleneck**: Workers writing to disk vs sending response back shows <2% difference
8. **Over-provisioning hurts**: Setting workers to 2x CPU count is 40% slower than cpus/2 due to context-switching overhead

## Recommended Default

```js
const os = require("os");
const poolSize = Math.min(Math.ceil(os.availableParallelism() / 2), totalTasks);
```

Half of available CPUs balances parallelism with overhead for large models. For CI/CD environments with fewer CPUs (2-4 cores), this naturally uses all available cores.
