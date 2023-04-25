const hre = require("hardhat");

async function main() {
  const DaoSplit = await hre.ethers.getContractFactory("DaoSplit");
  const nounsNFT = "<NOUNS_NFT_ADDRESS>";
  const nounsDao = "<NOUNS_DAO_ADDRESS>";
  const daoSplit = await DaoSplit.deploy(nounsNFT, nounsDao);

  await daoSplit.deployed();

  console.log("DaoSplit deployed to:", daoSplit.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
