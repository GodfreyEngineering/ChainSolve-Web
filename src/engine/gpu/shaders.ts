/**
 * shaders.ts — WGSL compute shaders (1.39).
 *
 * All shaders operate on f32 storage buffers.  Dimensions are passed as
 * uniform bind-group 0 binding 0, operands as bind-group 0 bindings 1+,
 * and the output as bind-group 0 binding (last).
 *
 * Shader naming convention:  SHADER_<OP>
 */

// ── Dense GEMM (tiled 16×16 workgroup) ──────────────────────────────────────
/**
 * C = A × B  where A is [M×K], B is [K×N], C is [M×N].
 *
 * Each workgroup tile is 16×16.  All buffers are row-major f32 arrays.
 *
 * Uniforms layout (4 × u32):
 *   [0] M  [1] K  [2] N
 */
export const SHADER_GEMM = /* wgsl */ `
struct Dims { M: u32, K: u32, N: u32, _pad: u32 }

@group(0) @binding(0) var<uniform> dims : Dims;
@group(0) @binding(1) var<storage, read>       A : array<f32>;
@group(0) @binding(2) var<storage, read>       B : array<f32>;
@group(0) @binding(3) var<storage, read_write> C : array<f32>;

const TILE = 16u;

var<workgroup> tA : array<array<f32, 16>, 16>;
var<workgroup> tB : array<array<f32, 16>, 16>;

@compute @workgroup_size(16, 16)
fn main(
  @builtin(global_invocation_id) gid  : vec3<u32>,
  @builtin(local_invocation_id)  lid  : vec3<u32>,
  @builtin(workgroup_id)         wgid : vec3<u32>,
) {
  let row = gid.y;
  let col = gid.x;
  var acc : f32 = 0.0;

  let numTiles = (dims.K + TILE - 1u) / TILE;
  for (var t = 0u; t < numTiles; t++) {
    let aCol = t * TILE + lid.x;
    let bRow = t * TILE + lid.y;

    if (row < dims.M && aCol < dims.K) {
      tA[lid.y][lid.x] = A[row * dims.K + aCol];
    } else {
      tA[lid.y][lid.x] = 0.0;
    }
    if (bRow < dims.K && col < dims.N) {
      tB[lid.y][lid.x] = B[bRow * dims.N + col];
    } else {
      tB[lid.y][lid.x] = 0.0;
    }
    workgroupBarrier();

    for (var k = 0u; k < TILE; k++) {
      acc += tA[lid.y][k] * tB[k][lid.x];
    }
    workgroupBarrier();
  }

  if (row < dims.M && col < dims.N) {
    C[row * dims.N + col] = acc;
  }
}
`

// ── Batch GEMM ───────────────────────────────────────────────────────────────
/**
 * Batch C[b] = A[b] × B[b]  for B_COUNT matrices.
 *
 * Uniforms: M, K, N, BATCH_COUNT (4 × u32).
 * Buffer layout: A contains BATCH_COUNT×M×K elements (row-major, batches contiguous).
 */
export const SHADER_BATCH_GEMM = /* wgsl */ `
struct Dims { M: u32, K: u32, N: u32, BATCH: u32 }

@group(0) @binding(0) var<uniform> dims : Dims;
@group(0) @binding(1) var<storage, read>       A : array<f32>;
@group(0) @binding(2) var<storage, read>       B : array<f32>;
@group(0) @binding(3) var<storage, read_write> C : array<f32>;

const TILE = 16u;
var<workgroup> tA : array<array<f32, 16>, 16>;
var<workgroup> tB : array<array<f32, 16>, 16>;

@compute @workgroup_size(16, 16)
fn main(
  @builtin(global_invocation_id) gid  : vec3<u32>,
  @builtin(local_invocation_id)  lid  : vec3<u32>,
  @builtin(workgroup_id)         wgid : vec3<u32>,
) {
  let b   = gid.z;
  let row = gid.y % dims.M;
  let col = gid.x % dims.N;
  if (b >= dims.BATCH) { return; }

  let aBase = b * dims.M * dims.K;
  let bBase = b * dims.K * dims.N;
  let cBase = b * dims.M * dims.N;

  var acc : f32 = 0.0;
  let numTiles = (dims.K + TILE - 1u) / TILE;
  for (var t = 0u; t < numTiles; t++) {
    let aCol = t * TILE + lid.x;
    let bRow = t * TILE + lid.y;
    if (row < dims.M && aCol < dims.K) {
      tA[lid.y][lid.x] = A[aBase + row * dims.K + aCol];
    } else { tA[lid.y][lid.x] = 0.0; }
    if (bRow < dims.K && col < dims.N) {
      tB[lid.y][lid.x] = B[bBase + bRow * dims.N + col];
    } else { tB[lid.y][lid.x] = 0.0; }
    workgroupBarrier();
    for (var k = 0u; k < TILE; k++) { acc += tA[lid.y][k] * tB[k][lid.x]; }
    workgroupBarrier();
  }
  if (row < dims.M && col < dims.N) {
    C[cBase + row * dims.N + col] = acc;
  }
}
`

// ── Sparse SpMV — CSR format ─────────────────────────────────────────────────
/**
 * y = A × x  where A is stored in CSR format.
 *
 * Buffers:
 *   binding 0: uniform [numRows: u32, _pad×3]
 *   binding 1: rowPtr (u32, length numRows+1)
 *   binding 2: colIdx (u32, length nnz)
 *   binding 3: values (f32, length nnz)
 *   binding 4: x      (f32, length numCols)
 *   binding 5: y      (f32, length numRows) — output
 */
export const SHADER_SPMV_CSR = /* wgsl */ `
struct Dims { numRows: u32, _p0: u32, _p1: u32, _p2: u32 }

@group(0) @binding(0) var<uniform>             dims   : Dims;
@group(0) @binding(1) var<storage, read>       rowPtr : array<u32>;
@group(0) @binding(2) var<storage, read>       colIdx : array<u32>;
@group(0) @binding(3) var<storage, read>       vals   : array<f32>;
@group(0) @binding(4) var<storage, read>       x      : array<f32>;
@group(0) @binding(5) var<storage, read_write> y      : array<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let row = gid.x;
  if (row >= dims.numRows) { return; }
  var acc : f32 = 0.0;
  let start = rowPtr[row];
  let end   = rowPtr[row + 1u];
  for (var j = start; j < end; j++) {
    acc += vals[j] * x[colIdx[j]];
  }
  y[row] = acc;
}
`

// ── Element-wise ops ─────────────────────────────────────────────────────────
/**
 * Parameterised by op code stored in the uniform.
 *
 * Op codes:
 *   0 = add (a + b)  1 = mul (a * b)  2 = sub (a - b)  3 = div (a / b)
 *   unary (only uses A):
 *   4 = exp  5 = sin  6 = cos  7 = sqrt  8 = abs  9 = neg
 *
 * Uniforms: [len: u32, opCode: u32, _pad×2]
 * Bindings for binary: A, B → out
 * Bindings for unary:  A → out (B bound to same buffer, unused)
 */
export const SHADER_ELEMENTWISE = /* wgsl */ `
struct Dims { len: u32, opCode: u32, _p0: u32, _p1: u32 }

@group(0) @binding(0) var<uniform>             dims : Dims;
@group(0) @binding(1) var<storage, read>       A    : array<f32>;
@group(0) @binding(2) var<storage, read>       B    : array<f32>;
@group(0) @binding(3) var<storage, read_write> out  : array<f32>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= dims.len) { return; }
  let a = A[i];
  switch dims.opCode {
    case 0u: { out[i] = a + B[i]; }
    case 1u: { out[i] = a * B[i]; }
    case 2u: { out[i] = a - B[i]; }
    case 3u: { out[i] = a / B[i]; }
    case 4u: { out[i] = exp(a); }
    case 5u: { out[i] = sin(a); }
    case 6u: { out[i] = cos(a); }
    case 7u: { out[i] = sqrt(a); }
    case 8u: { out[i] = abs(a); }
    case 9u: { out[i] = -a; }
    default: { out[i] = a; }
  }
}
`

// ── Reduction (sum / max / min) ───────────────────────────────────────────────
/**
 * Single-pass tree reduction within each workgroup; a second pass
 * reduces the partial results.  Caller runs two dispatches.
 *
 * Op codes: 0 = sum, 1 = max, 2 = min
 *
 * Uniforms: [len: u32, opCode: u32, _pad×2]
 * Bindings: input → partials (per-workgroup result)
 */
export const SHADER_REDUCE = /* wgsl */ `
struct Dims { len: u32, opCode: u32, _p0: u32, _p1: u32 }

@group(0) @binding(0) var<uniform>             dims     : Dims;
@group(0) @binding(1) var<storage, read>       input    : array<f32>;
@group(0) @binding(2) var<storage, read_write> partials : array<f32>;

const WG = 256u;
var<workgroup> shared : array<f32, 256>;

fn identity(opCode: u32) -> f32 {
  switch opCode {
    case 0u: { return 0.0; }           // sum → 0
    case 1u: { return -3.4e38; }       // max → -inf (approx)
    default:  { return  3.4e38; }      // min → +inf (approx)
  }
}

fn combine(a: f32, b: f32, opCode: u32) -> f32 {
  switch opCode {
    case 0u: { return a + b; }
    case 1u: { return max(a, b); }
    default:  { return min(a, b); }
  }
}

@compute @workgroup_size(256)
fn main(
  @builtin(global_invocation_id) gid : vec3<u32>,
  @builtin(local_invocation_id)  lid : vec3<u32>,
  @builtin(workgroup_id)         wid : vec3<u32>,
) {
  let i = gid.x;
  shared[lid.x] = select(identity(dims.opCode), input[i], i < dims.len);
  workgroupBarrier();

  var stride = WG / 2u;
  loop {
    if stride == 0u { break; }
    if lid.x < stride {
      shared[lid.x] = combine(shared[lid.x], shared[lid.x + stride], dims.opCode);
    }
    workgroupBarrier();
    stride = stride / 2u;
  }

  if lid.x == 0u {
    partials[wid.x] = shared[0];
  }
}
`

// ── FFT — Cooley-Tukey radix-2 DIT (power-of-2 sizes) ────────────────────────
/**
 * In-place split-radix FFT on complex data stored as interleaved f32 pairs
 * (re, im, re, im, …).  Input length must be a power of 2.
 *
 * Uniforms: [N: u32, stage: u32, _pad×2]
 * Binding:  data (f32, length 2×N) — input/output interleaved
 *
 * Caller iterates stages 0..log2(N)-1, dispatching N/2 threads per stage.
 */
export const SHADER_FFT_STAGE = /* wgsl */ `
struct Dims { N: u32, stage: u32, _p0: u32, _p1: u32 }

@group(0) @binding(0) var<uniform>             dims : Dims;
@group(0) @binding(1) var<storage, read_write> data : array<f32>;

const PI = 3.14159265358979323846f;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let k = gid.x;
  let halfN = dims.N / 2u;
  if k >= halfN { return; }

  let stageLen = 1u << (dims.stage + 1u);
  let group    = k / (stageLen / 2u);
  let idx      = k % (stageLen / 2u);

  let uIdx = group * stageLen + idx;
  let vIdx = uIdx + stageLen / 2u;

  let angle = -2.0 * PI * f32(idx) / f32(stageLen);
  let wr = cos(angle);
  let wi = sin(angle);

  let ure = data[2u * uIdx];
  let uim = data[2u * uIdx + 1u];
  let vre = data[2u * vIdx];
  let vim = data[2u * vIdx + 1u];

  let tre = wr * vre - wi * vim;
  let tim = wr * vim + wi * vre;

  data[2u * uIdx]     = ure + tre;
  data[2u * uIdx + 1u] = uim + tim;
  data[2u * vIdx]     = ure - tre;
  data[2u * vIdx + 1u] = uim - tim;
}
`
