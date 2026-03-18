/**
 * POST /api/graph/export/fmu — 10.3: Export a graph subgraph as an FMU.
 *
 * Accepts a graph snapshot and returns an FMU zip (FMI 2.0).
 * Full implementation requires 14.6 (FMI compliance).
 *
 * Authorization: Bearer JWT.
 *
 * Request body:
 *   { "snapshot": EngineSnapshotV1, "modelName": string, "version": "2.0" | "3.0" }
 *
 * Response 501: Not yet implemented (FMI export requires 14.6)
 */

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// FMU export is available once 14.6 (FMI 2.0/3.0 compliance) is implemented.
// Until then return a clear 501 with guidance.
export const onRequestPost: PagesFunction = async (_context) => {
  return json(
    {
      ok: false,
      error: '[NOT_IMPLEMENTED] FMU export is not yet available.',
      detail:
        'FMU export requires FMI 2.0/3.0 compliance work (roadmap item 14.6). ' +
        'Subscribe to the changelog at /api/health for release notifications.',
    },
    501,
  )
}
