import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';
import { createPublicClient, http, decodeEventLog, fallback } from 'viem';
import { authOptions } from '@/lib/auth';
import { inkChain } from '@/lib/wagmi';
import { ValidationError, AuthenticationError, NotFoundError, createErrorResponse, createSuccessResponse, ERROR_CODES } from '@/lib/errors';

const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const inkRpcEndpoints = Array.from(new Set([
  process.env.INK_RPC_URL,
  process.env.NEXT_PUBLIC_INK_RPC_URL,
  'https://rpc-qnd.inkonchain.com',
  'https://rpc-gel.inkonchain.com',
  'https://ink.drpc.org',
].filter((url): url is string => Boolean(url))));

const publicClient = createPublicClient({
  chain: inkChain,
  transport: fallback(
    inkRpcEndpoints.map((url) => http(url, { timeout: 4000, retryCount: 0 })),
    { retryCount: 0 }
  ),
});

// Minimal ABI fragment for the RaffleEntered event
const RAFFLE_ENTERED_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true,  internalType: 'uint256', name: 'raffleId',     type: 'uint256' },
      { indexed: true,  internalType: 'address', name: 'participant',  type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'ticketCount',  type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'pointsSpent',  type: 'uint256' },
    ],
    name: 'RaffleEntered',
    type: 'event',
  },
] as const;

interface EnterRaffleRequest {
  raffleId: string | number;
  ticketCount: number;
  txHash: string;
}

export async function POST(request: NextRequest) {
  try {
    // ── 1. Auth ──────────────────────────────────────────────────────────────
    const session = await getServerSession(authOptions);
    if (!session?.address) {
      throw new AuthenticationError();
    }
    const walletAddress = (session.address as string).toLowerCase();

    // ── 2. Parse & validate inputs ───────────────────────────────────────────
    const body: EnterRaffleRequest = await request.json();
    const { raffleId, ticketCount, txHash } = body;

    const parsedRaffleId = typeof raffleId === 'string' ? parseInt(raffleId, 10) : raffleId;
    if (!parsedRaffleId || !Number.isInteger(parsedRaffleId) || parsedRaffleId <= 0) {
      throw new ValidationError('Valid raffle ID is required', ERROR_CODES.INVALID_REQUEST, 400);
    }
    if (!Number.isInteger(ticketCount) || ticketCount <= 0) {
      throw new ValidationError('Ticket count must be a positive integer', ERROR_CODES.INVALID_TICKET_COUNT, 400);
    }
    if (!txHash || typeof txHash !== 'string' || txHash.length !== 66 || !txHash.startsWith('0x')) {
      throw new ValidationError('Valid transaction hash is required', ERROR_CODES.INVALID_REQUEST, 400);
    }

    // ── 3. Verify on-chain transaction ───────────────────────────────────────
    const raffleContractAddress = process.env.NEXT_PUBLIC_RAFFLE_CONTRACT_ADDRESS;
    if (!raffleContractAddress) {
      throw new ValidationError('Raffle contract not configured', ERROR_CODES.INVALID_REQUEST, 500);
    }

    let receipt;
    let tx;
    try {
      [receipt, tx] = await Promise.all([
        publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` }),
        publicClient.getTransaction({ hash: txHash as `0x${string}` }),
      ]);
    } catch (error) {
      console.error('Failed to verify raffle entry transaction:', error);
      throw new ValidationError(
        'Transaction is not confirmed yet. Please wait a moment and try again.',
        'INVALID_TRANSACTION',
        400
      );
    }

    if (!receipt || receipt.status !== 'success') {
      throw new ValidationError('Transaction not found or failed on-chain', 'INVALID_TRANSACTION', 400);
    }
    if (tx.from.toLowerCase() !== walletAddress) {
      throw new ValidationError('Transaction sender does not match your wallet', 'INVALID_TRANSACTION', 400);
    }
    if (tx.to?.toLowerCase() !== raffleContractAddress.toLowerCase()) {
      throw new ValidationError('Transaction was not sent to the raffle contract', 'INVALID_TRANSACTION', 400);
    }

    // Decode RaffleEntered event from receipt logs
    let onChainRaffleId: bigint | undefined;
    let onChainParticipant: string | undefined;
    let onChainTicketCount: bigint | undefined;
    let onChainPointsSpent: bigint | undefined;

    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: RAFFLE_ENTERED_ABI,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === 'RaffleEntered') {
          onChainRaffleId     = decoded.args.raffleId;
          onChainParticipant  = decoded.args.participant;
          onChainTicketCount  = decoded.args.ticketCount;
          onChainPointsSpent  = decoded.args.pointsSpent;
          break;
        }
      } catch {
        // Not a RaffleEntered log — skip
      }
    }

    if (onChainRaffleId === undefined) {
      throw new ValidationError('RaffleEntered event not found in transaction', 'INVALID_TRANSACTION', 400);
    }
    if (Number(onChainRaffleId) !== parsedRaffleId) {
      throw new ValidationError('Transaction raffle ID does not match request', 'INVALID_TRANSACTION', 400);
    }
    if (onChainParticipant?.toLowerCase() !== walletAddress) {
      throw new ValidationError('Transaction participant does not match your wallet', 'INVALID_TRANSACTION', 400);
    }
    if (Number(onChainTicketCount) !== ticketCount) {
      throw new ValidationError('Transaction ticket count does not match request', 'INVALID_TRANSACTION', 400);
    }

    // ── 4. Fetch all DB state in parallel ────────────────────────────────────
    const [existingEntryResult, raffleResult, existingEntriesResult] = await Promise.all([
      supabaseService
        .from('shellies_raffle_entries')
        .select('id')
        .eq('join_tx_hash', txHash)
        .maybeSingle(),
      supabaseService
        .from('shellies_raffle_raffles')
        .select('id, title, points_per_ticket, max_tickets_per_user, end_date')
        .eq('id', parsedRaffleId)
        .single(),
      supabaseService
        .from('shellies_raffle_entries')
        .select('ticket_count')
        .eq('wallet_address', walletAddress)
        .eq('raffle_id', parsedRaffleId),
    ]);

    if (existingEntryResult.error) {
      console.error('Failed to check duplicate raffle entry:', existingEntryResult.error);
      throw new ValidationError('Failed to validate transaction uniqueness', ERROR_CODES.DATABASE_ERROR, 500);
    }

    const { data: existingEntry } = existingEntryResult;
    if (existingEntry) {
      throw new ValidationError('This transaction has already been recorded', 'TRANSACTION_ALREADY_USED', 400);
    }

    // ── 5. Validate raffle and existing DB entries ───────────────────────────
    const { data: raffle, error: raffleError } = raffleResult;
    if (raffleError || !raffle) {
      throw new NotFoundError('Raffle not found', ERROR_CODES.RAFFLE_NOT_FOUND);
    }

    if (new Date(raffle.end_date) <= new Date()) {
      throw new ValidationError('This raffle has ended', ERROR_CODES.RAFFLE_ENDED, 400);
    }

    if (existingEntriesResult.error) {
      console.error('Failed to fetch existing raffle entries:', existingEntriesResult.error);
      throw new ValidationError('Failed to validate existing entries', ERROR_CODES.DATABASE_ERROR, 500);
    }

    const currentTickets = (existingEntriesResult.data || []).reduce((sum, e) => sum + e.ticket_count, 0);
    const newTotalTickets = currentTickets + ticketCount;

    if (currentTickets >= raffle.max_tickets_per_user) {
      throw new ValidationError(
        'You have already reached the maximum number of tickets for this raffle',
        ERROR_CODES.NO_REMAINING_TICKETS,
        400
      );
    }
    if (newTotalTickets > raffle.max_tickets_per_user) {
      const remaining = raffle.max_tickets_per_user - currentTickets;
      throw new ValidationError(
        `You can only purchase ${remaining} more ticket${remaining > 1 ? 's' : ''} for this raffle`,
        ERROR_CODES.MAX_TICKETS_EXCEEDED,
        400
      );
    }

    // ── 7. Record entry in DB ─────────────────────────────────────────────────
    // Points were already spent on-chain — no Supabase points deduction needed.
    const pointsSpent = Number(onChainPointsSpent ?? BigInt(raffle.points_per_ticket * ticketCount));

    const { data: entry, error: insertError } = await supabaseService
      .from('shellies_raffle_entries')
      .insert({
        wallet_address: walletAddress,
        raffle_id: parsedRaffleId,
        ticket_count: ticketCount,
        points_spent: pointsSpent,
        join_tx_hash: txHash,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to record raffle entry:', insertError);
      throw new ValidationError('Failed to record raffle entry', ERROR_CODES.DATABASE_ERROR, 500);
    }

    const message = ticketCount === 1
      ? `Successfully entered with 1 ticket for ${raffle.title}!`
      : `Successfully entered with ${ticketCount} tickets for ${raffle.title}!`;

    return NextResponse.json(createSuccessResponse(message, entry));

  } catch (error) {
    console.error('Error in raffle entry:', error);

    if (error instanceof ValidationError || error instanceof AuthenticationError || error instanceof NotFoundError) {
      return NextResponse.json(createErrorResponse(error), { status: (error as ValidationError).statusCode ?? 400 });
    }

    const unexpectedError = new ValidationError('An unexpected error occurred', 'INTERNAL_ERROR', 500);
    return NextResponse.json(createErrorResponse(unexpectedError), { status: 500 });
  }
}
