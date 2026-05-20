/**
 * Compile contracts and update TypeScript ABI files
 *
 * Usage:
 *   node scripts/compile-abis.js
 *   # or via npm:
 *   npm run compile:abis
 *
 * What it does:
 *   1. Runs `npx hardhat compile`
 *   2. Reads generated ABI from artifacts/
 *   3. Overwrites src/lib/raffle-abi.ts          (ShelliesRaffleContract ABI)
 *   4. Creates   src/lib/shellies-points-abi.ts   (ShelliesPoints ABI)
 *   5. Creates   src/lib/shellies-points-contract.ts (address + abi export)
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ARTIFACTS = path.join(ROOT, "artifacts", "contracts", "hardhat");
const SRC_LIB = path.join(ROOT, "src", "lib");

// ── Step 1: Compile ────────────────────────────────────────────────────────

console.log("Compiling contracts with Hardhat...");
try {
  execSync("npx hardhat compile", { cwd: ROOT, stdio: "inherit" });
} catch (err) {
  console.error("Compilation failed.");
  process.exit(1);
}
console.log("");

// ── Helper ─────────────────────────────────────────────────────────────────

function readAbi(fileName, contractName) {
  // Hardhat stores artifacts as: artifacts/<sources_path>/<FileName>.sol/<ContractName>.json
  const artifactPath = path.join(
    ARTIFACTS,
    `${fileName}.sol`,
    `${contractName}.json`
  );

  if (!fs.existsSync(artifactPath)) {
    console.error(`Artifact not found: ${artifactPath}`);
    console.error("Make sure compilation succeeded and the contract name matches.");
    process.exit(1);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  return artifact.abi;
}

function writeTs(filePath, content) {
  fs.writeFileSync(filePath, content, "utf8");
  console.log(`Updated: ${path.relative(ROOT, filePath)}`);
}

// ── Step 2: Raffle ABI (legacy / deployed-old contract) ───────────────────

const raffleAbi = readAbi("RaffleContract", "ShelliesRaffleContract");
const raffleAbiJson = JSON.stringify(raffleAbi, null, 2);

writeTs(
  path.join(SRC_LIB, "raffle-abi.ts"),
  `// AUTO-GENERATED — do not edit manually. Run: npm run compile:abis\n` +
  `export const raffle_abi = ${raffleAbiJson} as const;\n`
);

// ── Step 2b: New Raffle ABI (held-NFT only) ───────────────────────────────

const newRaffleAbi = readAbi("NewRaffleContract", "NewShelliesRaffleContract");
const newRaffleAbiJson = JSON.stringify(newRaffleAbi, null, 2);

writeTs(
  path.join(SRC_LIB, "newRaffle_contract_abi.ts"),
  `// AUTO-GENERATED — do not edit manually. Run: npm run compile:abis\n` +
  `export const new_raffle_abi = ${newRaffleAbiJson} as const;\n`
);

// ── Step 3: ShelliesPoints ABI ─────────────────────────────────────────────

const pointsAbi = readAbi("ShelliesPoints", "ShelliesPoints");
const pointsAbiJson = JSON.stringify(pointsAbi, null, 2);

writeTs(
  path.join(SRC_LIB, "shellies-points-abi.ts"),
  `// AUTO-GENERATED — do not edit manually. Run: npm run compile:abis\n` +
  `export const shelliesPointsAbi = ${pointsAbiJson} as const;\n`
);

// ── Step 4: ShelliesPoints contract config ─────────────────────────────────

const contractConfig = `// AUTO-GENERATED — do not edit manually. Run: npm run compile:abis
import { shelliesPointsAbi } from './shellies-points-abi';

export const SHELLIES_POINTS_ADDRESS = (
  process.env.NEXT_PUBLIC_SHELLIES_POINTS_CONTRACT_ADDRESS || '0x'
) as \`0x\${string}\`;

export const SHELLIES_POINTS_CONTRACT = {
  address: SHELLIES_POINTS_ADDRESS,
  abi: shelliesPointsAbi,
} as const;
`;

writeTs(path.join(SRC_LIB, "shellies-points-contract.ts"), contractConfig);

// ── Done ───────────────────────────────────────────────────────────────────

console.log("\nDone! ABI files updated:");
console.log("  src/lib/raffle-abi.ts");
console.log("  src/lib/newRaffle_contract_abi.ts");
console.log("  src/lib/shellies-points-abi.ts");
console.log("  src/lib/shellies-points-contract.ts");
console.log("\nNext step: deploy the contract with:");
console.log("  npm run deploy:shellies-points -- --network ink");
