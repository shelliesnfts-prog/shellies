/**
 * Updated Raffle Contract Deployment Script (Phase 4)
 * 
 * This script deploys the raffle contract with the new admin wallet approach:
 * - Removes server wallet dependency for raffle creation
 * - Enables admin wallets to directly control their prizes
 * - Maintains server role only for automated raffle ending
 */

const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying Updated Raffle Contract (Phase 4)...");
  console.log("=====================================\n");

  // Get deployment account
  const [deployer] = await hre.ethers.getSigners();
  console.log("📋 Deployment Details:");
  console.log("  Deploying with account:", deployer.address);
  console.log("  Account balance:", hre.ethers.utils.formatEther(await deployer.getBalance()), "ETH");
  console.log("  Network:", hre.network.name);
  console.log();

  // Deploy the contract
  console.log("📦 Deploying RaffleContract...");
  const RaffleContract = await hre.ethers.getContractFactory("RaffleContract");
  
  // Constructor args - no server wallet needed for creation
  const contract = await RaffleContract.deploy();
  await contract.deployed();

  console.log("✅ RaffleContract deployed to:", contract.address);
  console.log("   Transaction hash:", contract.deployTransaction.hash);
  console.log();

  // Wait for a few confirmations
  console.log("⏳ Waiting for confirmations...");
  await contract.deployTransaction.wait(5);
  console.log("✅ Contract confirmed!");
  console.log();

  // Setup roles
  console.log("👤 Setting up roles...");
  
  // Get environment variables for role setup
  const serverWalletAddress = process.env.RAFFLE_SERVER_ADDRESS;
  const adminAddresses = process.env.ADMIN_ADDRESSES?.split(',') || [];
  
  console.log("  Deployer has DEFAULT_ADMIN_ROLE and ADMIN_ROLE by default");
  
  // Grant SERVER_ROLE to server wallet (for automated ending only)
  if (serverWalletAddress) {
    console.log("  Granting SERVER_ROLE to:", serverWalletAddress);
    const serverRoleTx = await contract.grantRole(
      await contract.SERVER_ROLE(), 
      serverWalletAddress
    );
    await serverRoleTx.wait();
    console.log("  ✅ SERVER_ROLE granted (for automated raffle ending)");
  } else {
    console.log("  ⚠️  No SERVER_ADDRESS provided - automated ending will not work");
  }

  // Grant ADMIN_ROLE to additional admins
  if (adminAddresses.length > 0) {
    console.log("  Granting ADMIN_ROLE to additional addresses:");
    for (const adminAddr of adminAddresses) {
      if (adminAddr && adminAddr !== deployer.address) {
        console.log("    -", adminAddr);
        const adminRoleTx = await contract.grantRole(
          await contract.ADMIN_ROLE(),
          adminAddr.trim()
        );
        await adminRoleTx.wait();
      }
    }
    console.log("  ✅ Additional admin roles granted");
  }

  console.log();

  // Display deployment summary
  console.log("📊 Deployment Summary:");
  console.log("=====================================");
  console.log("Contract Address:", contract.address);
  console.log("Network:", hre.network.name);
  console.log("Deployer:", deployer.address);
  console.log("Gas Used:", contract.deployTransaction.gasLimit.toString());
  console.log();
  
  // New approach explanation  
  console.log("🔄 Migration to Admin Wallet Approach:");
  console.log("=====================================");
  console.log("✅ Admins now deploy raffles directly from their wallets");
  console.log("✅ No server wallet custody of prizes required");  
  console.log("✅ Better security and user control");
  console.log("✅ Transparent, user-signed transactions");
  console.log("⚠️  Server wallet only needed for automated raffle ending");
  console.log();

  // Environment setup instructions
  console.log("⚙️  Environment Setup:");
  console.log("=====================================");
  console.log("Add to your .env file:");
  console.log(`NEXT_PUBLIC_RAFFLE_CONTRACT_ADDRESS=${contract.address}`);
  if (serverWalletAddress) {
    console.log(`RAFFLE_SERVER_ADDRESS=${serverWalletAddress}`);
  }
  console.log();

  // Verification instructions
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("🔍 Verification:");
    console.log("=====================================");
    console.log("To verify the contract, run:");
    console.log(`npx hardhat verify --network ${hre.network.name} ${contract.address}`);
    console.log();
  }

  // Usage instructions
  console.log("🎯 Usage Instructions:");
  console.log("=====================================");
  console.log("1. Update your frontend to use the new admin wallet flow");
  console.log("2. Admins create raffles in database first (status: 'CREATED')");
  console.log("3. Admins deploy to blockchain using their wallet");  
  console.log("4. Database updated to 'ACTIVE' after successful deployment");
  console.log("5. Legacy server wallet creation methods return deprecation errors");
  console.log();

  console.log("🎉 Deployment Complete!");
  console.log("Contract ready for admin wallet raffle deployment!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });