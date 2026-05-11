/**
 * Deploy ShelliesPoints to Ink Mainnet (or testnet) and verify on Blockscout
 *
 * Usage:
 *   npm run deploy:shellies-points -- --network ink
 *   npm run deploy:shellies-points -- --network inkSepolia
 *
 * Required env vars (set in .env):
 *   DEPLOYER_PRIVATE_KEY          Deployer wallet private key (0x...)
 *   NEXT_PUBLIC_STAKING_CONTRACT_ADDRESS  TimeLockStaking contract address
 *   NEXT_PUBLIC_SHELLIES_CONTRACT_ADDRESS Shellies NFT contract address
 *   AUTHORIZED_SIGNER_ADDRESS     Public address of the XP voucher signing key
 *   INITIAL_SUPPLY               Hard cap on totalSupply, locked forever once set
 *                                  (optional, default 0 = uncapped; can be set later via setInitialSupply())
 *
 * After deployment, add the printed address to .env:
 *   NEXT_PUBLIC_SHELLIES_POINTS_CONTRACT_ADDRESS=0x...
 */

require("dotenv").config();
const hre = require("hardhat");

async function main() {
  const network = hre.network.name;
  console.log(`\nDeploying ShelliesPoints to: ${network}`);
  console.log("=".repeat(50));

  // ── Validate env vars ──────────────────────────────────────────────────

  const stakingContract = process.env.NEXT_PUBLIC_STAKING_CONTRACT_ADDRESS;
  const nftContract = process.env.NEXT_PUBLIC_SHELLIES_CONTRACT_ADDRESS;
  const authorizedSigner = process.env.AUTHORIZED_SIGNER_ADDRESS;
  const initialSupply = process.env.INITIAL_SUPPLY ? parseInt(process.env.INITIAL_SUPPLY, 10) : 0;

  if (!stakingContract || stakingContract === "0xYourRaffleContractAddressOnInkChain") {
    throw new Error("Missing NEXT_PUBLIC_STAKING_CONTRACT_ADDRESS in .env");
  }
  if (!nftContract || nftContract === "0xYourNFTContractAddressOnInkChain") {
    throw new Error("Missing NEXT_PUBLIC_SHELLIES_CONTRACT_ADDRESS in .env");
  }
  if (!authorizedSigner) {
    throw new Error("Missing AUTHORIZED_SIGNER_ADDRESS in .env");
  }

  console.log(`  Staking contract:     ${stakingContract}`);
  console.log(`  NFT contract:         ${nftContract}`);
  console.log(`  Authorized signer:    ${authorizedSigner}`);
  console.log(`  Initial supply (cap): ${initialSupply}${initialSupply === 0 ? "  (uncapped — set later via setInitialSupply())" : "  (hard cap, locked once set)"}`);

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
  const ShelliesPoints = await hre.ethers.getContractFactory("ShelliesPoints");
  const contract = await ShelliesPoints.deploy(stakingContract, nftContract, authorizedSigner, initialSupply);

  console.log(`Transaction hash:     ${contract.deploymentTransaction().hash}`);
  console.log("Waiting for confirmation...");

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log("\n" + "=".repeat(50));
  console.log(`ShelliesPoints deployed to: ${contractAddress}`);
  console.log("=".repeat(50));

  // ── Print next steps ───────────────────────────────────────────────────

  console.log("\nNext steps:");
  console.log(`  1. Add to .env:`);
  console.log(`     NEXT_PUBLIC_SHELLIES_POINTS_CONTRACT_ADDRESS=${contractAddress}`);
  console.log(`  2. Verify the contract (command below will run automatically)...`);

  // ── Verify ─────────────────────────────────────────────────────────────

  // Wait a few extra seconds for the block explorer to index the deployment
  console.log("\nWaiting 10 seconds for Blockscout to index the deployment...");
  await new Promise((resolve) => setTimeout(resolve, 10_000));

  console.log("Verifying contract on Blockscout...");
  try {
    await hre.run("verify:verify", {
      address: contractAddress,
      constructorArguments: [stakingContract, nftContract, authorizedSigner, initialSupply],
    });
    console.log("Contract verified successfully!");
    console.log(`  View on explorer: https://explorer.inkonchain.com/address/${contractAddress}`);
  } catch (err) {
    if (err.message?.includes("Already Verified") || err.message?.includes("already verified")) {
      console.log("Contract was already verified.");
    } else {
      console.warn(`Verification failed (you can retry manually):`);
      console.warn(
        `  npx hardhat verify --network ${network} ${contractAddress} ` +
        `"${stakingContract}" "${nftContract}" "${authorizedSigner}"`
      );
      console.warn(`Error: ${err.message}`);
    }
  }

  // ── Post-deployment checklist ──────────────────────────────────────────

  console.log("\n" + "=".repeat(50));
  console.log("Post-deployment checklist:");
  console.log(`  [ ] Add NEXT_PUBLIC_SHELLIES_POINTS_CONTRACT_ADDRESS=${contractAddress} to .env`);
  console.log(`  [ ] Add AUTHORIZED_SIGNER_PRIVATE_KEY=0x... to .env (server signing key)`);
  console.log(`  [ ] Add OWNER_PRIVATE_KEY=0x... to .env (for adminMint/Burn scripts)`);
  console.log(`  [ ] Run: npm run compile:abis  (regenerate ABI files)`);
  console.log(`  [ ] Call setOperator(<raffle_contract>, true) from owner wallet`);
  console.log(`  [ ] Apply DB migration 028 (shellies_points_nonces table)`);
  console.log(`  [ ] Apply DB migration 029 (deduct_xp_and_record_nonce function)`);
  console.log(`  [ ] Run migration script: npx tsx scripts/migrate-points-onchain.ts --dry-run`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nDeployment failed:", err.message || err);
    process.exit(1);
  });
