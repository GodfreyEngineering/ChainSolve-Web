/**
 * engineContractVersion.ts — P118 shared engine contract version constant.
 *
 * This must stay in sync with:
 *   - src/engine/index.ts  EXPECTED_CONTRACT_VERSION
 *   - crates/engine-core/src/catalog.rs  ENGINE_CONTRACT_VERSION
 *
 * Used by the marketplace service layer to reject items that require a newer
 * engine than this app version supports.
 */

/**
 * The engine contract version this app was built against.
 * Marketplace items specifying `minContractVersion > ENGINE_CONTRACT_VERSION`
 * are incompatible with the current app and will be rejected at install time.
 */
export const ENGINE_CONTRACT_VERSION = 1
