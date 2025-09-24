const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying MinimalTestContract...");

  const MinimalTestContract = await ethers.getContractFactory("MinimalTestContract");
  
  // Deploy with explicit gas settings
  const contract = await MinimalTestContract.deploy({
    gasLimit: 1000000,
    gasPrice: ethers.utils.parseUnits('20', 'gwei')
  });

  await contract.deployed();
  console.log("MinimalTestContract deployed to:", contract.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});