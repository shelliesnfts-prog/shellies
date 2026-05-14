/**
 * Deploy ShelliesRaffleContract to Ink Mainnet (or testnet) and verify on Blockscout
 *
 * Usage:
 *   npm run deploy:shellies-raffles -- --network ink
 *   npm run deploy:shellies-raffles -- --network inkSepolia
 *
 * Required env vars (set in .env):
 *   DEPLOYER_PRIVATE_KEY   Deployer wallet private key (0x...)
 *
 * After deployment, add the printed address to .env:
 *   NEXT_PUBLIC_RAFFLE_CONTRACT_ADDRESS=0x...
 */

require("dotenv").config();
const hre = require("hardhat");

async function main() {
  const network = hre.network.name;
  console.log(`\nDeploying ShelliesRaffleContract to: ${network}`);
  console.log("=".repeat(50));

  // ── Get deployer ───────────────────────────────────────────────────────

  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);

  console.log(`\nDeployer address:     ${deployer.address}`);
  console.log(`Deployer balance:     ${hre.ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    throw new Error("Deployer wallet has no ETH. Fund it before deploying.");
  }

  // ── Deploy ─────────────────────────────────────────────────────────────

  console.log("\nDeploying contract...");
  const ShelliesRaffleContract = await hre.ethers.getContractFactory("ShelliesRaffleContract");
  const contract = await ShelliesRaffleContract.deploy();

  console.log(`Transaction hash:     ${contract.deploymentTransaction().hash}`);
  console.log("Waiting for confirmation...");

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log("\n" + "=".repeat(50));
  console.log(`ShelliesRaffleContract deployed to: ${contractAddress}`);
  console.log("=".repeat(50));

  // ── Print next steps ───────────────────────────────────────────────────

  console.log("\nNext steps:");
  console.log(`  1. Add to .env:`);
  console.log(`     NEXT_PUBLIC_RAFFLE_CONTRACT_ADDRESS=${contractAddress}`);
  console.log(`  2. Verify the contract (command below will run automatically)...`);

  // ── Verify ─────────────────────────────────────────────────────────────

  // Wait a few extra seconds for the block explorer to index the deployment
  console.log("\nWaiting 10 seconds for Blockscout to index the deployment...");
  await new Promise((resolve) => setTimeout(resolve, 10_000));

  console.log("Verifying contract on Blockscout...");
  try {
    await hre.run("verify:verify", {
      address: contractAddress,
      constructorArguments: [],
    });
    console.log("Contract verified successfully!");
    console.log(`  View on explorer: https://explorer.inkonchain.com/address/${contractAddress}`);
  } catch (err) {
    if (err.message?.includes("Already Verified") || err.message?.includes("already verified")) {
      console.log("Contract was already verified.");
    } else {
      console.warn(`Verification failed (you can retry manually):`);
      console.warn(`  npx hardhat verify --network ${network} ${contractAddress}`);
      console.warn(`Error: ${err.message}`);
    }
  }

  // ── Post-deployment checklist ──────────────────────────────────────────

  console.log("\n" + "=".repeat(50));
  console.log("Post-deployment checklist:");
  console.log(`  [ ] Add NEXT_PUBLIC_RAFFLE_CONTRACT_ADDRESS=${contractAddress} to .env`);
  console.log(`  [ ] Run: npm run compile:abis  (regenerate ABI files)`);
  console.log(`  [ ] Call setOperator(${contractAddress}, true) on ShelliesPoints contract from owner wallet`);
  console.log(`  [ ] Call setShelliesPointsContract(<shellies_points_address>) on this contract from admin wallet`);
  console.log(`  [ ] Call addAdmin(<server_wallet>) from deployer wallet if server needs admin access`);
  console.log(`  NOTE: pointsPerTicket is now set per-raffle at creation time — no global config needed`);
  console.log(`  [ ] End all active raffles before switching frontend to new contract address`);
  console.log(`  [ ] Apply DB migration 030 (rename points/last_claim columns to legacy)`);
  console.log(`  [ ] Apply DB migration 031 (drop legacy DB functions) — last step after full cutover`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nDeployment failed:", err.message || err);
    process.exit(1);
  });
