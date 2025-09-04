/**
 * POST /api/redpacket/prepare
 * Prepares a DoB red packet by creating virtual CKB tx and BTC PSBT
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRgbppCkbVirtualTx } from '@/services/rgbpp/buildCkbVirtualTx';
import { createBtcPsbt } from '@/services/rgbpp/buildBtcPsbt';
import psbtGuard from '@/lib/psbtGuard';

// In-memory storage for drafts (in production, use a database)
const drafts = new Map<string, any>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ckbFromAddress, dob, btc } = body;

    // Validate input
    if (!ckbFromAddress || !dob || !btc) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('📝 Preparing red packet...');
    console.log('CKB Address:', ckbFromAddress);
    console.log('DoB Data:', dob);
    console.log('BTC Config:', btc);

    // Step 1: Create virtual CKB transaction
    const rgbppCkbVirtualTx = await createRgbppCkbVirtualTx({
      fromCkbAddress: ckbFromAddress,
      dobData: {
        title: dob.title || 'Red Packet',
        coverCid: dob.coverCid || '',
        message: dob.message || 'Best wishes!',
        amount: dob.amount || '0.0001 BTC'
      }
    });

    // Step 2: Create BTC PSBT from virtual transaction
    const { psbtBase64 } = await createBtcPsbt({
      rgbppCkbVirtualTx,
      btcUtxos: btc.utxos,
      changeAddress: btc.changeAddress,
      amountSats: btc.amountSats
    });

    // Step 3: Convert PSBT to hex format for JoyID
    const psbtHex = psbtGuard.guardForJoyId(psbtBase64);

    // Generate draft ID and store
    const draftId = `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    drafts.set(draftId, {
      rgbppCkbVirtualTx,
      psbtBase64,
      psbtHex,
      ckbFromAddress,
      dob,
      btc,
      createdAt: new Date().toISOString(),
      status: 'DRAFT'
    });

    console.log('✅ Red packet prepared successfully');
    console.log('Draft ID:', draftId);
    console.log('PSBT hex prefix:', psbtHex.substring(0, 16));

    return NextResponse.json({
      draftId,
      psbtHex,
      rgbppCkbVirtualTx,
      debug: {
        psbtLength: psbtHex.length,
        psbtPrefix: psbtHex.substring(0, 16)
      }
    });

  } catch (error) {
    console.error('Error preparing red packet:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to prepare red packet' },
      { status: 500 }
    );
  }
}

// Export drafts for other routes to use
export { drafts };