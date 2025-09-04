# RGB++ Strong Binding Implementation Changelog

## [feat/rgbpp-strong-binding-v1] - 2025-01-09

### Step 0: Init env & dev sanity check (no code change)
- Created feature branch: feat/rgbpp-strong-binding-v1
- Configured .env.local with testnet settings
- Verified project structure:
  - /gift/new: Create gift entry point ✓
  - /gift/pool: Gift list page ✓  
  - /api/spv/proof: SPV proof proxy ✓
- Development server running successfully on port 3004
- Base dependencies confirmed: JoyID + CCC for dual-chain interaction

### Step 1: Unified wallet and PSBT handling
- Created psbtGuard module to enforce hex format for JoyID
- Validates PSBT magic bytes (70736274ff)
- Integrated guard into JoyID bitcoin module
- Test page at /test-psbt for validation
- Prevents "Trying to access beyond buffer length" errors

### Step 2: RGB++ virtual transaction implementation  
- Created buildCkbVirtualTx service for virtual CKB transactions
- Created buildBtcPsbt service to generate PSBTs from virtual tx
- Added POST /api/redpacket/prepare endpoint
- Integrated new flow into /gift/new page
- Returns draftId, psbtHex, and virtual CKB tx structure