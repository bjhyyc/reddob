/**
 * GET /api/redpacket/drafts
 * Lists all existing drafts for debugging
 */

import { NextResponse } from 'next/server';
import { draftsStorage } from '@/lib/draftsStorage';

export async function GET() {
  try {
    const allDrafts = await draftsStorage.getAll();
    const draftsList = allDrafts.map((draft) => ({
      ...draft,
      // Remove sensitive data
      psbtBase64: '[REDACTED]',
      psbtHex: '[REDACTED]'
    }));

    return NextResponse.json({
      count: await draftsStorage.size(),
      drafts: draftsList
    });

  } catch (error) {
    console.error('Error listing drafts:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list drafts' },
      { status: 500 }
    );
  }
}