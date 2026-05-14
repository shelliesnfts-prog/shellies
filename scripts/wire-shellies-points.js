/**
 * Wire newly-deployed ShelliesPoints to the existing Raffle contract.
 *
 * Performs:
 *   1. ShelliesPoints.setOperator(raffleContract, true)   (owner)
 *   2. RaffleContract.setShelliesPointsContract(newSPTS)  (admin)
 *
 * Usage:
 *   npm run wire:shellies-points -- --network ink
 *
 * Required env:
 *   DEPLOYER_PRIVATE_KEY                          (must be SPTS owner + Raffle admin)
 *   NEXT_PUBLIC_SHELLIES_POINTS_CONTRACT_ADDRESS  (newly deployed SPTS)
 *   NEXT_PUBLIC_RAFFLE_CONTRACT_ADDRESS           (raffle contract)
 */

require("dotenv").config();
const hre = require("hardhat");

async function main() {
  const sptsAddr   = process.env.NEXT_PUBLIC_SHELLIES_POINTS_CONTRACT_ADDRESS;
  const raffleAddr = process.env.NEXT_PUBLIC_RAFFLE_CONTRACT_ADDRESS;

  if (!sptsAddr)   throw new Error("Missing NEXT_PUBLIC_SHELLIES_POINTS_CONTRACT_ADDRESS");
  if (!raffleAddr) throw new Error("Missing NEXT_PUBLIC_RAFFLE_CONTRACT_ADDRESS");

  const [signer] = await hre.ethers.getSigners();
  console.log(`\nSigner:  ${signer.address}`);
  console.log(`SPTS:    ${sptsAddr}`);
  console.log(`Raffle:  ${raffleAddr}`);
  console.log("=".repeat(50));

  // ── 1. SPTS.setOperator(raffle, true) ──────────────────────────────────────
  const spts = await hre.ethers.getContractAt("ShelliesPoints", sptsAddr, signer);

  const owner = await spts.owner();
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(`Signer is not SPTS owner. Owner=${owner}, signer=${signer.address}`);
  }

  const isOp = await spts.operators(raffleAddr);
  if (isOp) {
    console.log("✓ Raffle is already an operator on SPTS — skipping setOperator.");
  } else {
    console.log("→ Calling SPTS.setOperator(raffle, true) ...");
    const tx1 = await spts.setOperator(raffleAddr, true);
    console.log(`  tx: ${tx1.hash}`);
    const r1 = await tx1.wait();
    console.log(`  ✓ confirmed in block ${r1.blockNumber}`);
  }

  // ── 2. Raffle.setShelliesPointsContract(spts) ──────────────────────────────
  const raffle = await hre.ethers.getContractAt("ShelliesRaffleContract", raffleAddr, signer);

  const ADMIN_ROLE = await raffle.ADMIN_ROLE();
  const isAdmin = await raffle.hasRole(ADMIN_ROLE, signer.address);
  if (!isAdmin) {
    throw new Error(`Signer does not have ADMIN_ROLE on raffle. Cannot set points contract.`);
  }

  const currentPoints = await raffle.shelliesPointsContract();
  if (currentPoints.toLowerCase() === sptsAddr.toLowerCase()) {
    console.log("✓ Raffle already points to new SPTS — skipping setShelliesPointsContract.");
  } else {
    console.log(`→ Calling Raffle.setShelliesPointsContract(${sptsAddr}) ...`);
    console.log(`  (was: ${currentPoints})`);
    const tx2 = await raffle.setShelliesPointsContract(sptsAddr);
    console.log(`  tx: ${tx2.hash}`);
    const r2 = await tx2.wait();
    console.log(`  ✓ confirmed in block ${r2.blockNumber}`);
  }

  // ── Final state ────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(50));
  console.log("Final state:");
  console.log(`  SPTS.operators(raffle)         = ${await spts.operators(raffleAddr)}`);
  console.log(`  Raffle.shelliesPointsContract  = ${await raffle.shelliesPointsContract()}`);
  console.log(`  SPTS.maxSupply                 = ${await spts.maxSupply()}`);
  console.log(`  SPTS.maxSupplySet              = ${await spts.maxSupplySet()}`);
  console.log(`  SPTS.totalSupply               = ${await spts.totalSupply()}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nWiring failed:", err.message || err);
    process.exit(1);
  });
