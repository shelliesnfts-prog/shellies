/**
 * Deploy NewShelliesRaffleContract (held-NFT-only) to Ink Mainnet or Sepolia
 * and verify on Blockscout.
 *
 * Usage:
 *   npm run deploy:new-raffle -- --network ink
 *   npm run deploy:new-raffle -- --network inkSepolia
 *
 * Required env vars (.env):
 *   DEPLOYER_PRIVATE_KEY   Deployer wallet private key (0x...)
 *
 * After deployment:
 *   1. Set NEXT_PUBLIC_RAFFLE_CONTRACT_ADDRESS in .env to the printed address.
 *   2. Call setShelliesPointsContract(<points_address>) on this contract from admin wallet.
 *   3. Call setOperator(<new_raffle_address>, true) on the ShelliesPoints contract from the points owner wallet.
 *   4. Call addAdmin(<server_wallet>) from deployer wallet if server-side flows need admin role.
 */

require("dotenv").config();
const hre = require("hardhat");

async function main() {
  const network = hre.network.name;
  console.log(`\nDeploying NewShelliesRaffleContract to: ${network}`);
  console.log("=".repeat(60));

  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);

  console.log(`\nDeployer address:     ${deployer.address}`);
  console.log(`Deployer balance:     ${hre.ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    throw new Error("Deployer wallet has no ETH. Fund it before deploying.");
  }

  console.log("\nDeploying contract...");
  const Factory = await hre.ethers.getContractFactory("NewShelliesRaffleContract");
  const contract = await Factory.deploy();

  console.log(`Transaction hash:     ${contract.deploymentTransaction().hash}`);
  console.log("Waiting for confirmation...");

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log("\n" + "=".repeat(60));
  console.log(`NewShelliesRaffleContract deployed to: ${contractAddress}`);
  console.log("=".repeat(60));

  console.log("\nNext steps:");
  console.log(`  1. Update .env:`);
  console.log(`     NEXT_PUBLIC_RAFFLE_CONTRACT_ADDRESS=${contractAddress}`);
  console.log(`  2. Set ShelliesPoints address on this contract (from admin wallet):`);
  console.log(`     setShelliesPointsContract(<NEXT_PUBLIC_SHELLIES_POINTS_CONTRACT_ADDRESS>)`);
  console.log(`  3. Authorize this contract on ShelliesPoints (from points owner):`);
  console.log(`     setOperator(${contractAddress}, true)`);

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

  console.log("\n" + "=".repeat(60));
  console.log("Post-deployment checklist:");
  console.log(`  [ ] Update NEXT_PUBLIC_RAFFLE_CONTRACT_ADDRESS in .env`);
  console.log(`  [ ] Run: npm run compile:abis (already done if you followed deploy workflow)`);
  console.log(`  [ ] setShelliesPointsContract(<points_addr>) on this contract`);
  console.log(`  [ ] setOperator(${contractAddress}, true) on ShelliesPoints from owner wallet`);
  console.log(`  [ ] addAdmin(<server_wallet>) if server admin needed`);
  console.log(`  [ ] Run DB migration 032 with the OLD contract address backfilled BEFORE flipping env`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nDeployment failed:", err.message || err);
    process.exit(1);
  });
