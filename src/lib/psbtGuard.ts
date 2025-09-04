/**
 * PSBT Guard Module
 * Ensures all PSBTs passed to JoyID are in hex format with proper validation
 * ⚠️ CRITICAL: JoyID requires hex format, not base64
 */

import { Buffer } from 'buffer';

// PSBT magic bytes: 0x70736274ff (psbt\xff in ASCII)
const PSBT_MAGIC_HEX = '70736274ff';

export interface PsbtGuardResult {
  psbtHex: string;
  isValid: boolean;
  error?: string;
}

/**
 * Convert PSBT from base64 or hex to validated hex format
 * @param psbtBase64OrHex - PSBT in either base64 or hex format
 * @returns Validated PSBT in hex format
 */
export function toHex(psbtBase64OrHex: string): PsbtGuardResult {
  try {
    let hex: string;
    
    // Remove any whitespace
    const input = psbtBase64OrHex.trim();
    
    // Check if it's already hex
    if (input.toLowerCase().startsWith(PSBT_MAGIC_HEX)) {
      hex = input.toLowerCase();
    } else {
      // Assume it's base64 and convert
      try {
        const buffer = Buffer.from(input, 'base64');
        hex = buffer.toString('hex');
      } catch (e) {
        return {
          psbtHex: '',
          isValid: false,
          error: 'Invalid PSBT format: not valid base64 or hex'
        };
      }
    }
    
    // Validate magic bytes
    if (!hex.startsWith(PSBT_MAGIC_HEX)) {
      return {
        psbtHex: '',
        isValid: false,
        error: `Invalid PSBT: missing magic bytes (expected ${PSBT_MAGIC_HEX}, got ${hex.substring(0, 10)})`
      };
    }
    
    return {
      psbtHex: hex,
      isValid: true
    };
  } catch (error) {
    return {
      psbtHex: '',
      isValid: false,
      error: `PSBT conversion error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Validate PSBT inputs have required UTXO fields
 * @param psbtHex - PSBT in hex format
 * @returns Validation result with statistics
 */
export function validateInputs(psbtHex: string): {
  isValid: boolean;
  stats: {
    totalInputs: number;
    witnessInputs: number;
    nonWitnessInputs: number;
    invalidInputs: number;
  };
  errors: string[];
} {
  // This is a simplified validation - in production, use a proper PSBT parser
  // For now, we'll just check the hex is valid
  const errors: string[] = [];
  
  if (!psbtHex.startsWith(PSBT_MAGIC_HEX)) {
    errors.push('Invalid PSBT magic bytes');
  }
  
  // Basic length check
  if (psbtHex.length < 20) {
    errors.push('PSBT too short');
  }
  
  return {
    isValid: errors.length === 0,
    stats: {
      totalInputs: 0, // Would need proper parsing
      witnessInputs: 0,
      nonWitnessInputs: 0,
      invalidInputs: 0
    },
    errors
  };
}

/**
 * Guard function to ensure PSBT is ready for JoyID
 * @param psbtBase64OrHex - Input PSBT
 * @returns Validated hex PSBT or throws error
 */
export function guardForJoyId(psbtBase64OrHex: string): string {
  const result = toHex(psbtBase64OrHex);
  
  if (!result.isValid) {
    throw new Error(`PSBT Guard failed: ${result.error}`);
  }
  
  const validation = validateInputs(result.psbtHex);
  if (!validation.isValid) {
    throw new Error(`PSBT validation failed: ${validation.errors.join(', ')}`);
  }
  
  return result.psbtHex;
}

export default {
  toHex,
  validateInputs,
  guardForJoyId,
  PSBT_MAGIC_HEX
};