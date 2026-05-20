/**
 * Mint ShelliesPoints from a wallet_address,points CSV export.
 *
 * Send this file together with the CSV export and run it from that same folder.
 *
 * Folder layout on the operator's PC:
 *   migration-folder/
 *     mint-points-from-csv.js
 *     points-leaderboard.csv
 *     .env
 *
 * The CSV file must include these exact headers:
 *   wallet_address,points
 *
 * Create a .env file in the same folder with:
 *   OWNER_PRIVATE_KEY=0xYourOwnerWalletPrivateKey
 *   SHELLIES_POINTS_ADDRESS=0xYourShelliesPointsContractAddress
 *
 * Optional .env value:
 *   INK_RPC_URL=https://rpc-qnd.inkonchain.com
 *
 * Commands to run from migration-folder:
 *   node mint-points-from-csv.js points-leaderboard.csv
 *   node mint-points-from-csv.js points-leaderboard.csv --live
 *   node mint-points-from-csv.js points-leaderboard.csv --live --concurrency=5
 *   node mint-points-from-csv.js points-leaderboard.csv --live --start=100 --limit=50
 *
 * The first command is a dry run. It sends no transactions.
 * Add --live only after reviewing the dry-run audit CSV.
 *
 * Duplicate wallets:
 *   If the CSV contains the same wallet more than once, the script uses only
 *   the first row and ignores later duplicate rows.
 *
 * Resume safety:
 *   In --live mode, every successfully confirmed wallet is removed from the
 *   CSV file. The script also checks the current on-chain balance before
 *   minting and only mints the missing difference.
 *
 * Important:
 *   OWNER_PRIVATE_KEY must be the private key for the wallet that owns the
 *   ShelliesPoints contract, because the script calls owner-only adminMint().
 *   The script sends one on-chain transaction per wallet with points > 0.
 *   --concurrency controls how many transactions are sent/waited at the same
 *   time. Start with 3-5. Higher values can hit RPC rate limits.
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const DEFAULT_RPC_URL = 'https://rpc-qnd.inkonchain.com';
const POINTS_CONTRACT_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function adminMint(address user, uint256 amount) external',
];

const args = process.argv.slice(2);
const csvPath = args.find((arg) => !arg.startsWith('--'));
const isLive = args.includes('--live');
const start = readNumberArg('--start', 0);
const limit = readOptionalNumberArg('--limit');
const concurrency = readNumberArg('--concurrency', 3);

if (!csvPath) {
  console.error('Usage: node mint-points-from-csv.js points-leaderboard.csv [--live] [--start=N] [--limit=N]');
  console.error('');
  console.error('Run this command from the folder containing mint-points-from-csv.js, points-leaderboard.csv, and .env.');
  process.exit(1);
}

if (start < 0 || (limit !== undefined && limit <= 0) || concurrency <= 0 || concurrency > 25) {
  console.error('--start must be >= 0, --limit must be > 0, and --concurrency must be between 1 and 25');
  process.exit(1);
}

function readNumberArg(name, fallback) {
  const value = readOptionalNumberArg(name);
  return value === undefined ? fallback : value;
}

function readOptionalNumberArg(name) {
  const arg = args.find((value) => value.startsWith(`${name}=`));
  if (!arg) return undefined;

  const parsed = Number(arg.slice(name.length + 1));
  if (!Number.isInteger(parsed)) {
    console.error(`${name} must be an integer`);
    process.exit(1);
  }

  return parsed;
}

function parseCsvLine(line) {
  const cells = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(cell);
      cell = '';
      continue;
    }

    cell += char;
  }

  cells.push(cell);
  return cells;
}

function readCsvFile(filePath) {
  const resolvedPath = path.resolve(filePath);
  const raw = fs.readFileSync(resolvedPath, 'utf8').replace(/^\uFEFF/, '');
  return { resolvedPath, raw };
}

function parsePointsCsv(filePath) {
  const { raw } = readCsvFile(filePath);
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return { rows: [], duplicateRows: [] };
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
  const walletIndex = headers.indexOf('wallet_address');
  const pointsIndex = headers.indexOf('points');

  if (walletIndex < 0 || pointsIndex < 0) {
    throw new Error('CSV must include wallet_address and points columns');
  }

  const seenWallets = new Set();
  const rows = [];
  const duplicateRows = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const cells = parseCsvLine(lines[lineIndex]);
    const rawWallet = (cells[walletIndex] || '').trim();
    const rawPoints = (cells[pointsIndex] || '').trim();

    if (!rawWallet && !rawPoints) {
      continue;
    }

    if (!ethers.isAddress(rawWallet)) {
      throw new Error(`Invalid wallet at CSV line ${lineIndex + 1}: ${rawWallet}`);
    }

    const wallet = ethers.getAddress(rawWallet);
    const walletKey = wallet.toLowerCase();
    if (seenWallets.has(walletKey)) {
      duplicateRows.push({
        wallet,
        points: rawPoints,
        csvLine: lineIndex + 1,
      });
      continue;
    }
    seenWallets.add(walletKey);

    const points = Number(rawPoints);
    if (!Number.isFinite(points)) {
      throw new Error(`Invalid points at CSV line ${lineIndex + 1}: ${rawPoints}`);
    }

    rows.push({
      wallet,
      points,
      mintAmount: Math.round(points),
      csvLine: lineIndex + 1,
    });
  }

  return { rows, duplicateRows };
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function auditLine(row, status, txHash = '', error = '') {
  return [
    row.csvLine,
    row.wallet,
    row.points,
    row.mintAmount,
    status,
    txHash,
    error,
  ].map(csvEscape).join(',');
}

function duplicateAuditLine(row) {
  return [
    row.csvLine,
    row.wallet,
    row.points,
    0,
    'duplicate-skipped',
    '',
    'Duplicate wallet ignored; first CSV row for this wallet was used',
  ].map(csvEscape).join(',');
}

function removeWalletsFromCsv(filePath, walletsToRemove) {
  if (walletsToRemove.size === 0) return;

  const { resolvedPath, raw } = readCsvFile(filePath);
  const lines = raw.split(/\r?\n/);
  const header = lines[0] || '';
  const headers = parseCsvLine(header).map((value) => value.trim().toLowerCase());
  const walletIndex = headers.indexOf('wallet_address');

  if (walletIndex < 0) {
    throw new Error('Cannot update CSV because wallet_address column was not found');
  }

  const keptLines = [header];

  for (const line of lines.slice(1)) {
    if (line.trim().length === 0) continue;

    const cells = parseCsvLine(line);
    const wallet = (cells[walletIndex] || '').trim().toLowerCase();

    if (!walletsToRemove.has(wallet)) {
      keptLines.push(line);
    }
  }

  fs.writeFileSync(resolvedPath, keptLines.join('\n') + '\n');
}

function createCsvRemovalQueue(filePath) {
  const walletsToRemove = new Set();
  let pendingWrite = Promise.resolve();

  return function queueRemoval(wallet) {
    walletsToRemove.add(wallet.toLowerCase());
    pendingWrite = pendingWrite.then(() => {
      removeWalletsFromCsv(filePath, walletsToRemove);
    });
    return pendingWrite;
  };
}

async function processLiveRow(contract, row, getNextNonce, queueCsvRemoval) {
  try {
    const targetAmount = BigInt(row.mintAmount);
    const currentBalance = await contract.balanceOf(row.wallet);
    const amountToMint = targetAmount > currentBalance ? targetAmount - currentBalance : BigInt(0);

    if (amountToMint <= BigInt(0)) {
      console.log(`SKIP  ${row.wallet}: already has ${currentBalance.toString()} / target ${targetAmount.toString()}`);
      await queueCsvRemoval(row.wallet);
      return auditLine(row, 'already-funded', '', `Current balance ${currentBalance.toString()} >= target ${targetAmount.toString()}`);
    }

    const nonce = getNextNonce();
    const tx = await contract.adminMint(row.wallet, amountToMint, { nonce });
    console.log(`SENT  nonce=${nonce} ${row.wallet}: mint ${amountToMint.toString()} / target ${targetAmount.toString()} | ${tx.hash}`);

    const receipt = await tx.wait();
    const txHash = receipt.hash || tx.hash;
    console.log(`MINT  nonce=${nonce} ${row.wallet}: minted ${amountToMint.toString()} | ${txHash}`);
    await queueCsvRemoval(row.wallet);

    return auditLine({ ...row, mintAmount: Number(amountToMint) }, 'minted', txHash);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`ERROR ${row.wallet}: ${message}`);
    return auditLine(row, 'error', '', message);
  }
}

async function runWithConcurrency(items, worker, maxConcurrency) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }

  const workers = Array.from(
    { length: Math.min(maxConcurrency, items.length) },
    () => runWorker()
  );

  await Promise.all(workers);
  return results;
}

async function main() {
  const parsed = parsePointsCsv(csvPath);
  const rows = parsed.rows
    .filter((row) => row.mintAmount > 0)
    .slice(start, limit === undefined ? undefined : start + limit);

  console.log(isLive ? '=== LIVE RUN: transactions will be sent ===' : '=== DRY RUN: no transactions will be sent ===');
  console.log(`Working folder: ${process.cwd()}`);
  console.log(`CSV: ${path.resolve(csvPath)}`);
  console.log(`Rows to mint: ${rows.length}`);
  console.log(`Duplicate rows ignored: ${parsed.duplicateRows.length}`);
  console.log(`Concurrency: ${isLive ? concurrency : 'dry-run'}`);

  let contract = null;

  if (isLive) {
    const privateKey = process.env.OWNER_PRIVATE_KEY;
    const contractAddress = process.env.SHELLIES_POINTS_ADDRESS || process.env.NEXT_PUBLIC_SHELLIES_POINTS_CONTRACT_ADDRESS;
    const rpcUrl = process.env.INK_RPC_URL || DEFAULT_RPC_URL;

    if (!privateKey) {
      throw new Error('Missing OWNER_PRIVATE_KEY. Put OWNER_PRIVATE_KEY=0x... in the .env file next to this script.');
    }
    if (!contractAddress || !ethers.isAddress(contractAddress)) {
      throw new Error('Missing or invalid SHELLIES_POINTS_ADDRESS. Put SHELLIES_POINTS_ADDRESS=0x... in the .env file next to this script.');
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const ownerWallet = new ethers.Wallet(privateKey, provider);
    contract = new ethers.Contract(contractAddress, POINTS_CONTRACT_ABI, ownerWallet);

    console.log(`Contract: ${contractAddress}`);
    console.log(`Owner: ${ownerWallet.address}`);
    console.log(`RPC: ${rpcUrl}`);

    const backupPath = `${path.resolve(csvPath)}.backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    fs.copyFileSync(path.resolve(csvPath), backupPath);
    console.log(`CSV backup: ${backupPath}`);
  }

  const auditRows = [
    'csv_line,wallet_address,points,minted_points,status,tx_hash,error',
    ...parsed.duplicateRows.map(duplicateAuditLine),
  ];

  if (!isLive) {
    for (const row of rows) {
      console.log(`DRY   ${row.wallet}: ${row.points} -> ${row.mintAmount}`);
      auditRows.push(auditLine(row, 'dry-run'));
    }
  } else {
    const ownerAddress = await contract.runner.getAddress();
    const startNonce = await contract.runner.provider.getTransactionCount(ownerAddress, 'pending');
    const queueCsvRemoval = createCsvRemovalQueue(csvPath);
    let nextNonce = startNonce;
    const getNextNonce = () => {
      const nonce = nextNonce;
      nextNonce += 1;
      return nonce;
    };
    console.log(`Starting nonce: ${startNonce}`);

    const liveAuditRows = await runWithConcurrency(
      rows,
      (row) => processLiveRow(contract, row, getNextNonce, queueCsvRemoval),
      concurrency
    );
    auditRows.push(...liveAuditRows);
  }

  const outputPath = isLive ? 'mint-points-audit.csv' : 'mint-points-audit-dry.csv';
  fs.writeFileSync(outputPath, auditRows.join('\n'));
  console.log(`Done. Audit log saved to ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
