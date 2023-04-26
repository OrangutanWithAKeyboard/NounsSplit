const { expect } = require("chai");
const { ethers } = require("hardhat");

async function depositNFTs(from, nounsNFT, daoSplit, startTokenId, endTokenId) {
  for (let i = startTokenId; i <= endTokenId; i++) {
    await nounsNFT.connect(from).approve(daoSplit.address, i);
    await daoSplit.connect(from).deposit(i, '');
  }
}

describe("DaoSplit", function () {
  let DaoSplit, daoSplit, NounsNFT, nounsNFT, ogDao, owner, addr1, addr2;

  beforeEach(async function () {
    // Get signers
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
  
    // Deploy a mock NounsNFT contract
    NounsNFT = await ethers.getContractFactory("ERC721Mock");
    nounsNFT = await NounsNFT.deploy("NounsNFT", "NFT");
    await nounsNFT.deployed();
  
    // Deploy a mock OgDAO contract
    OgDAO = await ethers.getContractFactory("OgDAOMock");
    ogDao = await OgDAO.deploy();
    await ogDao.deployed();
  
    // Deploy the DaoSplit contract
    DaoSplit = await ethers.getContractFactory("DaoSplit");
    daoSplit = await DaoSplit.deploy(nounsNFT.address, ogDao.address);
    await daoSplit.deployed();
  
    // Mint some NFTs
    for (let i = 1; i <= 7; i++) {
      await nounsNFT.mint(addr1.address, i);
    }
    for (let i = 8; i <= 14; i++) {
      await nounsNFT.mint(addr2.address, i);
    }
  });

  it("Should deposit 1 Noun", async function () {
    await nounsNFT.connect(addr1).approve(daoSplit.address, 1);
    await daoSplit.connect(addr1).deposit(1, '');

    expect(await daoSplit.depositedNouns()).to.equal(1);
    expect(await daoSplit.currentPeriod()).to.equal(0);
    expect(await nounsNFT.ownerOf(1)).to.equal(daoSplit.address);
    expect(await nounsNFT.ownerOf(2)).to.equal(addr1.address);
  });

  it("Should deposit 2 Nouns", async function () {
    await nounsNFT.connect(addr1).approve(daoSplit.address, 1);
    await daoSplit.connect(addr1).deposit(1, '');

    await nounsNFT.connect(addr1).approve(daoSplit.address, 3);
    await daoSplit.connect(addr1).deposit(3, '');

    expect(await daoSplit.depositedNouns()).to.equal(2);
    expect(await daoSplit.currentPeriod()).to.equal(0);
    expect(await nounsNFT.ownerOf(1)).to.equal(daoSplit.address);
    expect(await nounsNFT.ownerOf(3)).to.equal(daoSplit.address);
  });
  
  it("Should deposit 2 Nouns from 2 users", async function () {
    await nounsNFT.connect(addr1).approve(daoSplit.address, 1);
    await daoSplit.connect(addr1).deposit(1, '');

    await nounsNFT.connect(addr2).approve(daoSplit.address, 8);
    await daoSplit.connect(addr2).deposit(8, '');

    expect(await daoSplit.depositedNouns()).to.equal(2);
    expect(await daoSplit.currentPeriod()).to.equal(0);
    expect(await nounsNFT.ownerOf(1)).to.equal(daoSplit.address);
    expect(await nounsNFT.ownerOf(8)).to.equal(daoSplit.address);
  });

  it("Should deposit with reason", async function () {
    await nounsNFT.connect(addr1).approve(daoSplit.address, 1);
    await daoSplit.connect(addr1).deposit(1, 'Evil person taking over dao, must save dao');

    expect((await daoSplit.depositedNounsInfo(1))[2]).to.equal('Evil person taking over dao, must save dao');
  });

  it("Should deposit and reach the split threshold", async function () {
    await depositNFTs(addr1, nounsNFT, daoSplit, 1, 7);

    expect(await daoSplit.depositedNouns()).to.equal(7);
    expect(await daoSplit.currentPeriod()).to.equal(1);
  });

  it("Should still allow deposits after meeting the split threshold", async function () {
    await depositNFTs(addr1, nounsNFT, daoSplit, 1, 7);

    await nounsNFT.connect(addr2).approve(daoSplit.address, 8);
    await daoSplit.connect(addr2).deposit(8, '');

    expect(await daoSplit.depositedNouns()).to.equal(8);
    expect(await daoSplit.currentPeriod()).to.equal(1);
    expect(await nounsNFT.ownerOf(8)).to.equal(daoSplit.address);
  });

  it("Should allow 1 withdrawal", async function () {
    await nounsNFT.connect(addr2).approve(daoSplit.address, 8);
    await daoSplit.connect(addr2).deposit(8, '');

    await daoSplit.connect(addr2).withdraw(8);

    expect(await daoSplit.depositedNouns()).to.equal(0);
    expect(await daoSplit.currentPeriod()).to.equal(0);
    expect(await nounsNFT.ownerOf(8)).to.equal(addr2.address);
  });

  it("Should allow 3 withdrawals from 1 user", async function () {
    await depositNFTs(addr1, nounsNFT, daoSplit, 1, 3);

    await daoSplit.connect(addr1).withdraw(1);
    await daoSplit.connect(addr1).withdraw(2);
    await daoSplit.connect(addr1).withdraw(3);

    expect(await daoSplit.depositedNouns()).to.equal(0);
    expect(await daoSplit.currentPeriod()).to.equal(0);
    expect(await nounsNFT.ownerOf(1)).to.equal(addr1.address);
    expect(await nounsNFT.ownerOf(2)).to.equal(addr1.address);
    expect(await nounsNFT.ownerOf(3)).to.equal(addr1.address);
  });

  it("Should allow 5 withdrawals from 2 users", async function () {
    await depositNFTs(addr1, nounsNFT, daoSplit, 1, 2);
    await depositNFTs(addr2, nounsNFT, daoSplit, 8, 11);

    await daoSplit.connect(addr2).withdraw(8);
    await daoSplit.connect(addr2).withdraw(10);
    await daoSplit.connect(addr2).withdraw(11);

    await daoSplit.connect(addr1).withdraw(1);
    await daoSplit.connect(addr1).withdraw(2);

    expect(await daoSplit.depositedNouns()).to.equal(1);
    expect(await daoSplit.currentPeriod()).to.equal(0);
    expect(await nounsNFT.ownerOf(1)).to.equal(addr1.address);
    expect(await nounsNFT.ownerOf(2)).to.equal(addr1.address);
    expect(await nounsNFT.ownerOf(8)).to.equal(addr2.address);
    expect(await nounsNFT.ownerOf(9)).to.equal(daoSplit.address);
    expect(await nounsNFT.ownerOf(10)).to.equal(addr2.address);
    expect(await nounsNFT.ownerOf(11)).to.equal(addr2.address);
  });

  it("Should revert on a repeat withdrawal", async function () {
    await nounsNFT.connect(addr2).approve(daoSplit.address, 8);
    await daoSplit.connect(addr2).deposit(8, '');

    await daoSplit.connect(addr2).withdraw(8);
    await expect(daoSplit.connect(addr2).withdraw(8)).to.be.revertedWith("Only the depositor can withdraw");
    
    expect(await daoSplit.depositedNouns()).to.equal(0);
    expect(await nounsNFT.ownerOf(8)).to.equal(addr2.address);
  });

  it("Should not allow withdraws after meeting the split threshold", async function () {
    await depositNFTs(addr1, nounsNFT, daoSplit, 1, 7);

    await nounsNFT.connect(addr2).approve(daoSplit.address, 8);
    await daoSplit.connect(addr2).deposit(8, '');

    await expect(daoSplit.connect(addr2).withdraw(8)).to.be.revertedWith("Withdrawals only allowed in pre split period");
    expect(await daoSplit.depositedNouns()).to.equal(8);
    expect(await daoSplit.currentPeriod()).to.equal(1);
    expect(await nounsNFT.ownerOf(8)).to.equal(daoSplit.address);
  });

  it("Should not allow triggering the split before the 7-day period has passed", async function () {
    await depositNFTs(addr1, nounsNFT, daoSplit, 1, 7);

    await expect(daoSplit.triggerSplit()).to.be.revertedWith("Not in post split period");
  });

  // Split Tests

  it("Should move nouns after split period in 1 batch", async function () {
    // Deposit NFTs
    await depositNFTs(addr1, nounsNFT, daoSplit, 1, 7);
  
    // Move to post split period
    await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]); // Increase time by 7 days
    await ethers.provider.send("evm_mine"); // Mine the next block
  
    // Move Nouns to owner
    await daoSplit.triggerSplitMoveNouns([1, 2, 3, 4, 5, 6, 7]);
  
    // Check if Nouns have been moved
    for (let i = 1; i <= 7; i++) {
      expect(await nounsNFT.ownerOf(i)).to.equal(ogDao.address);
    }
  });

  it("Should move nouns after split period in 2 batches", async function () {
    // Deposit NFTs
    await depositNFTs(addr1, nounsNFT, daoSplit, 1, 7);
  
    // Move to post split period
    await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]); // Increase time by 7 days
    await ethers.provider.send("evm_mine"); // Mine the next block
  
    // Move Nouns to owner
    await daoSplit.triggerSplitMoveNouns([5, 6, 7]);
    await daoSplit.triggerSplitMoveNouns([1, 2, 3, 4]);

  
    // Check if Nouns have been moved
    for (let i = 1; i <= 7; i++) {
      expect(await nounsNFT.ownerOf(i)).to.equal(ogDao.address);
    }
  });
  
  it("Should triggerSplit after Nouns have been moved", async function () {
    // Deposit NFTs
    await depositNFTs(addr1, nounsNFT, daoSplit, 1, 7);
  
    // Move to post split period
    await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]); // Increase time by 7 days
    await ethers.provider.send("evm_mine"); // Mine the next block
  
    // Move Nouns to owner
    await daoSplit.triggerSplitMoveNouns([1, 2, 3, 4, 5, 6, 7]);
  
    // Send the ETH
    await owner.sendTransaction({
      to: daoSplit.address,
      value: ethers.utils.parseEther("10"),
    });
  
    // Call triggerSplit
    await daoSplit.triggerSplit();
  
    // Check if the contract's Ether balance is 10 ether
    expect(await ethers.provider.getBalance(daoSplit.address)).to.equal("10000000000000000000");

    // Check if the ogDao has been transferred all Nouns
    expect(await nounsNFT.balanceOf(ogDao.address)).to.equal(7);

    // Check if the DaoSplit has transferred all Nouns
    expect(await nounsNFT.balanceOf(daoSplit.address)).to.equal(0);
  });
  

  // REDEMPTION TESTS

  it.skip("Should trigger the split and let users redeem assets", async function () {
    // Simulate asset transfer from OgDAO to DaoSplit
    await ogDao.transferAssets(daoSplit.address, 7);
  
    await depositNFTs(addr1, nounsNFT, daoSplit, 0, 7);
  
    await ethers.provider.send("evm_increaseTime", [7 * 24 * 3600]); // Increase time by 7 days
    await ethers.provider.send("evm_mine"); // Mine the next block
  
    await daoSplit.triggerSplit();
  
    // Redeem assets
    for (let i = 0; i < 7; i++) {
      await daoSplit.connect(addr1).redeem(i);
      expect(await ethers.provider.getBalance(addr1.address)).to.be.above(ethers.utils.parseEther("0"));
    }
  });

  it.skip("Should not allow redeeming assets before triggering the split", async function () {
    await depositNFTs(addr1, nounsNFT, daoSplit, 0, 7);

    await ethers.provider.send("evm_increaseTime", [7 * 24 * 3600]); // Increase time by 7 days
    await ethers.provider.send("evm_mine"); // Mine the next block

    await expect(daoSplit.connect(addrs[0]).redeem()).to.be.revertedWith("Split has not been triggered yet");
  });

});
