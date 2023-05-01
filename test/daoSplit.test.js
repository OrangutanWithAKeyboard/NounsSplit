const { expect } = require("chai");
const { ethers } = require("hardhat");

async function depositNFTs(from, nounsNFT, daoSplit, startTokenId, endTokenId) {
  let nounsArr = [];
  for (let i = startTokenId; i <= endTokenId; i++) {
    await nounsNFT.connect(from).approve(daoSplit.address, i);
    nounsArr.push(i);
  }
  await daoSplit.connect(from).deposit(nounsArr, '');
}

describe("DaoSplit", function () {
  let DaoSplit, daoSplit, NounsNFT, nounsNFT, mockToken, mockToken2, ogDao, owner, addr1, addr2;

  beforeEach(async function () {
    // Reset state manually, although normally the state is reset but was not being done for the redemption tests. This solves that
    await ethers.provider.send("hardhat_reset");

    // Get signers
    [owner, addr1, addr2, addr3, ...addrs] = await ethers.getSigners();
  
    // Deploy a mock NounsNFT contract
    NounsNFT = await ethers.getContractFactory("ERC721Mock");
    nounsNFT = await NounsNFT.deploy("NounsNFT", "NFT");
    await nounsNFT.deployed();

    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    mockToken = await ERC20Mock.deploy("Mock Token", "MKRY");
    await mockToken.deployed();

    mockToken2 = await ERC20Mock.deploy("Mock Token2", "MKRY2");
    await mockToken2.deployed();
  
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
    for (let i = 8; i <= 15; i++) {
      await nounsNFT.mint(addr2.address, i);
    }
    for (let i = 16; i <= 20; i++) {
      await nounsNFT.mint(addr3.address, i);
    }
  });

  it("Should deposit 1 Noun", async function () {
    await nounsNFT.connect(addr1).approve(daoSplit.address, 1);
    await daoSplit.connect(addr1).deposit([1], '');

    expect(await daoSplit.depositedNouns()).to.equal(1);
    expect(await daoSplit.currentPeriod()).to.equal(0);
    expect(await nounsNFT.ownerOf(1)).to.equal(daoSplit.address);
    expect(await nounsNFT.ownerOf(2)).to.equal(addr1.address);
  });

  it("Should deposit 2 Nouns", async function () {
    await nounsNFT.connect(addr1).approve(daoSplit.address, 1);
    await daoSplit.connect(addr1).deposit([1], '');

    await nounsNFT.connect(addr1).approve(daoSplit.address, 3);
    await daoSplit.connect(addr1).deposit([3], '');

    expect(await daoSplit.depositedNouns()).to.equal(2);
    expect(await daoSplit.currentPeriod()).to.equal(0);
    expect(await nounsNFT.ownerOf(1)).to.equal(daoSplit.address);
    expect(await nounsNFT.ownerOf(3)).to.equal(daoSplit.address);
  });
  
  it("Should deposit 2 Nouns from 2 users", async function () {
    await nounsNFT.connect(addr1).approve(daoSplit.address, 1);
    await daoSplit.connect(addr1).deposit([1], '');

    await nounsNFT.connect(addr2).approve(daoSplit.address, 8);
    await daoSplit.connect(addr2).deposit([8], '');

    expect(await daoSplit.depositedNouns()).to.equal(2);
    expect(await daoSplit.currentPeriod()).to.equal(0);
    expect(await nounsNFT.ownerOf(1)).to.equal(daoSplit.address);
    expect(await nounsNFT.ownerOf(8)).to.equal(daoSplit.address);
  });

  it("Should deposit with reason", async function () {
    await nounsNFT.connect(addr1).approve(daoSplit.address, 1);
    await daoSplit.connect(addr1).deposit([1], 'Evil person taking over dao, must save dao');

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
    await daoSplit.connect(addr2).deposit([8], '');

    expect(await daoSplit.depositedNouns()).to.equal(8);
    expect(await daoSplit.currentPeriod()).to.equal(1);
    expect(await nounsNFT.ownerOf(8)).to.equal(daoSplit.address);
  });

  it("Should allow 1 withdrawal", async function () {
    await nounsNFT.connect(addr2).approve(daoSplit.address, 8);
    await daoSplit.connect(addr2).deposit([8], '');

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
    await daoSplit.connect(addr2).deposit([8], '');

    await daoSplit.connect(addr2).withdraw(8);
    await expect(daoSplit.connect(addr2).withdraw(8)).to.be.revertedWith("Only the depositor can withdraw");
    
    expect(await daoSplit.depositedNouns()).to.equal(0);
    expect(await nounsNFT.ownerOf(8)).to.equal(addr2.address);
  });

  it("Should not allow withdraws after meeting the split threshold", async function () {
    await depositNFTs(addr1, nounsNFT, daoSplit, 1, 7);

    await nounsNFT.connect(addr2).approve(daoSplit.address, 8);
    await daoSplit.connect(addr2).deposit([8], '');

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

  it("Should trigger the split and let 1 user redeem their 100% share", async function () {
    // Mint 10,000 tokens to ogDao
    await mockToken.connect(owner).mint(ogDao.address, 10000);
    await mockToken2.connect(owner).mint(ogDao.address, 8000);
    
    const ogDaoBalanceBefore = await mockToken.balanceOf(ogDao.address);
    expect(ogDaoBalanceBefore).to.equal(10000);

    // Send the ETH
    await owner.sendTransaction({
      to: ogDao.address,
      value: ethers.utils.parseEther("10"),
    });

    await ogDao.connect(owner).setSupportedTokens([mockToken.address, mockToken2.address]);

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

    const ogDaoBefore1 = await mockToken.balanceOf(ogDao.address);
    expect(ogDaoBefore1).to.equal(10000);

    const ogDaoBefore2 = await mockToken2.balanceOf(ogDao.address);
    expect(ogDaoBefore2).to.equal(8000);

    expect(await ethers.provider.getBalance(daoSplit.address)).to.equal("0");

    // moves funds to daoSplit
    await daoSplit.connect(owner).triggerSplit();

    const ogDaoAfter = await mockToken.balanceOf(ogDao.address);
    expect(ogDaoAfter).to.equal(0);

    const daoSplitAfter = await mockToken.balanceOf(daoSplit.address);
    expect(daoSplitAfter).to.equal(10000);

    const ogDaoAfter2 = await mockToken2.balanceOf(ogDao.address);
    expect(ogDaoAfter2).to.equal(0);

    const daoSplitAfter2 = await mockToken2.balanceOf(daoSplit.address);
    expect(daoSplitAfter2).to.equal(8000);

    expect(await ethers.provider.getBalance(daoSplit.address)).to.equal("10000000000000000000");

    // REDEEM

    const addr1Before1 = await mockToken.balanceOf(addr1.address);
    expect(addr1Before1).to.equal(0);

    const addr1Before2 = await mockToken2.balanceOf(addr1.address);
    expect(addr1Before2).to.equal(0);

    // 10,000 ETH less gas
    expect(await (await ethers.provider.getBalance(addr1.address)).toString().slice(0, 5)).to.equal("9999998538373005517296".slice(0, 5));

    await daoSplit.connect(addr1).redeem();


    // Checks if everything was redeemed

    const addr1After1 = await mockToken.balanceOf(addr1.address);
    expect(addr1After1).to.equal(10000);

    const addr1After2 = await mockToken2.balanceOf(addr1.address);
    expect(addr1After2).to.equal(8000);

    // 10,010 ETH less gas
    expect(await (await ethers.provider.getBalance(addr1.address)).toString().slice(0, 5)).to.equal("10009998399390210084704".slice(0, 5));

  });

  it("Should let 2 users redeem 40:60", async function () {
    // Mint 10,000 tokens to ogDao
    await mockToken.connect(owner).mint(ogDao.address, 10000);
    await mockToken2.connect(owner).mint(ogDao.address, 8000);
    
    const ogDaoBalanceBefore = await mockToken.balanceOf(ogDao.address);
    expect(ogDaoBalanceBefore).to.equal(10000);

    // Send the ETH
    await owner.sendTransaction({
      to: ogDao.address,
      value: ethers.utils.parseEther("10"),
    });

    await ogDao.connect(owner).setSupportedTokens([mockToken.address, mockToken2.address]);

    // Deposit NFTs
    await depositNFTs(addr1, nounsNFT, daoSplit, 1, 6);
    await depositNFTs(addr2, nounsNFT, daoSplit, 8, 11);
  
    // Move to post split period
    await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]); // Increase time by 7 days
    await ethers.provider.send("evm_mine"); // Mine the next block
  
    const nounsDeposited = [1, 2, 3, 4, 5, 6, 8, 9, 10, 11];
    // Move Nouns to owner
    await daoSplit.triggerSplitMoveNouns(nounsDeposited);
  
    // Check if Nouns have been moved
    for (let i = 1; i < nounsDeposited.length; i++) {
      expect(await nounsNFT.ownerOf(nounsDeposited[i])).to.equal(ogDao.address);
    }

    const ogDaoBefore1 = await mockToken.balanceOf(ogDao.address);
    expect(ogDaoBefore1).to.equal(10000);

    const ogDaoBefore2 = await mockToken2.balanceOf(ogDao.address);
    expect(ogDaoBefore2).to.equal(8000);

    expect(await ethers.provider.getBalance(daoSplit.address)).to.equal("0");

    // moves funds to daoSplit
    await daoSplit.connect(owner).triggerSplit();

    const ogDaoAfter = await mockToken.balanceOf(ogDao.address);
    expect(ogDaoAfter).to.equal(0);

    const daoSplitAfter = await mockToken.balanceOf(daoSplit.address);
    expect(daoSplitAfter).to.equal(10000);

    const ogDaoAfter2 = await mockToken2.balanceOf(ogDao.address);
    expect(ogDaoAfter2).to.equal(0);

    const daoSplitAfter2 = await mockToken2.balanceOf(daoSplit.address);
    expect(daoSplitAfter2).to.equal(8000);

    expect(await ethers.provider.getBalance(daoSplit.address)).to.equal("10000000000000000000");

    // REDEEM addr1

    const addr1Before1 = await mockToken.balanceOf(addr1.address);
    expect(addr1Before1).to.equal(0);

    const addr1Before2 = await mockToken2.balanceOf(addr1.address);
    expect(addr1Before2).to.equal(0);

    expect(await (await ethers.provider.getBalance(addr1.address)).toString().slice(0, 5)).to.equal("9999998538373005517296".slice(0, 5));

    await daoSplit.connect(addr1).redeem();

    const addr1After1 = await mockToken.balanceOf(addr1.address);
    expect(addr1After1).to.equal(6000);

    const addr1After2 = await mockToken2.balanceOf(addr1.address);
    expect(addr1After2).to.equal(4800);

    expect(await (await ethers.provider.getBalance(addr1.address)).toString().slice(0, 5)).to.equal("10005998399390210084704".slice(0, 5));

    // REDEEM addr2

    const addr2Before1 = await mockToken.balanceOf(addr2.address);
    expect(addr2Before1).to.equal(0);

    const addr2Before2 = await mockToken2.balanceOf(addr2.address);
    expect(addr2Before2).to.equal(0);

    expect(await (await ethers.provider.getBalance(addr2.address)).toString().slice(0, 5)).to.equal("9999998538373005517296".slice(0, 5));

    await daoSplit.connect(addr2).redeem();

    const addr2After1 = await mockToken.balanceOf(addr2.address);
    expect(addr2After1).to.equal(4000);

    const addr2After2 = await mockToken2.balanceOf(addr2.address);
    expect(addr2After2).to.equal(3200);

    expect(await (await ethers.provider.getBalance(addr2.address)).toString().slice(0, 5)).to.equal("10003998399390210084704".slice(0, 5));

  });

  it("Should let 3 users redeem 25:25:50", async function () {
    // Mint 10,000 tokens to ogDao
    await mockToken.connect(owner).mint(ogDao.address, 10000);
    await mockToken2.connect(owner).mint(ogDao.address, 8000);
    
    const ogDaoBalanceBefore = await mockToken.balanceOf(ogDao.address);
    expect(ogDaoBalanceBefore).to.equal(10000);

    // Send the ETH
    await owner.sendTransaction({
      to: ogDao.address,
      value: ethers.utils.parseEther("10"),
    });

    await ogDao.connect(owner).setSupportedTokens([mockToken.address, mockToken2.address]);

    // Deposit NFTs
    await depositNFTs(addr1, nounsNFT, daoSplit, 1, 2);
    await depositNFTs(addr2, nounsNFT, daoSplit, 8, 9);
    await depositNFTs(addr3, nounsNFT, daoSplit, 16, 19);
  
    // Move to post split period
    await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]); // Increase time by 7 days
    await ethers.provider.send("evm_mine"); // Mine the next block
  
    const nounsDeposited = [1, 2, 8, 9, 16, 17, 18, 19];
    // Move Nouns to owner
    await daoSplit.triggerSplitMoveNouns(nounsDeposited);
  
    // Check if Nouns have been moved
    for (let i = 1; i < nounsDeposited.length; i++) {
      expect(await nounsNFT.ownerOf(nounsDeposited[i])).to.equal(ogDao.address);
    }

    const ogDaoBefore1 = await mockToken.balanceOf(ogDao.address);
    expect(ogDaoBefore1).to.equal(10000);

    const ogDaoBefore2 = await mockToken2.balanceOf(ogDao.address);
    expect(ogDaoBefore2).to.equal(8000);

    expect(await ethers.provider.getBalance(daoSplit.address)).to.equal("0");

    // moves funds to daoSplit
    await daoSplit.connect(owner).triggerSplit();

    const ogDaoAfter = await mockToken.balanceOf(ogDao.address);
    expect(ogDaoAfter).to.equal(0);

    const daoSplitAfter = await mockToken.balanceOf(daoSplit.address);
    expect(daoSplitAfter).to.equal(10000);

    const ogDaoAfter2 = await mockToken2.balanceOf(ogDao.address);
    expect(ogDaoAfter2).to.equal(0);

    const daoSplitAfter2 = await mockToken2.balanceOf(daoSplit.address);
    expect(daoSplitAfter2).to.equal(8000);

    expect(await ethers.provider.getBalance(daoSplit.address)).to.equal("10000000000000000000");

    // REDEEM addr1

    const addr1Before1 = await mockToken.balanceOf(addr1.address);
    expect(addr1Before1).to.equal(0);

    const addr1Before2 = await mockToken2.balanceOf(addr1.address);
    expect(addr1Before2).to.equal(0);

    expect(await (await ethers.provider.getBalance(addr1.address)).toString().slice(0, 5)).to.equal("9999998538373005517296".slice(0, 5));

    await daoSplit.connect(addr1).redeem();

    const addr1After1 = await mockToken.balanceOf(addr1.address);
    expect(addr1After1).to.equal(2500);

    const addr1After2 = await mockToken2.balanceOf(addr1.address);
    expect(addr1After2).to.equal(2000);

    expect(await (await ethers.provider.getBalance(addr1.address)).toString().slice(0, 6)).to.equal("10002498399390210084704".slice(0, 6));


    // REDEEM addr2

    const addr2Before1 = await mockToken.balanceOf(addr2.address);
    expect(addr2Before1).to.equal(0);

    const addr2Before2 = await mockToken2.balanceOf(addr2.address);
    expect(addr2Before2).to.equal(0);

    expect(await (await ethers.provider.getBalance(addr2.address)).toString().slice(0, 5)).to.equal("9999998538373005517296".slice(0, 5));

    await daoSplit.connect(addr2).redeem();

    const addr2After1 = await mockToken.balanceOf(addr2.address);
    expect(addr2After1).to.equal(2499); // less 1 wei rounding error due to 1 decimal place mock token

    const addr2After2 = await mockToken2.balanceOf(addr2.address);
    expect(addr2After2).to.equal(1999); // less 1 wei rounding error due to 1 decimal place mock token

    expect(await (await ethers.provider.getBalance(addr2.address)).toString().slice(0, 6)).to.equal("10002498399390210084704".slice(0, 6));


    // REDEEM addr3

    const addr3Before1 = await mockToken.balanceOf(addr3.address);
    expect(addr3Before1).to.equal(0);

    const addr3Before2 = await mockToken2.balanceOf(addr3.address);
    expect(addr3Before2).to.equal(0);

    expect(await (await ethers.provider.getBalance(addr3.address)).toString().slice(0, 5)).to.equal("9999998538373005517296".slice(0, 5));

    await daoSplit.connect(addr3).redeem();

    const addr3After1 = await mockToken.balanceOf(addr3.address);
    expect(addr3After1).to.equal(5001); // + 1 wei rounding error due to 1 decimal place mock token

    const addr3After2 = await mockToken2.balanceOf(addr3.address);
    expect(addr3After2).to.equal(4001); // + 1 wei rounding error due to 1 decimal place mock token

    expect(await (await ethers.provider.getBalance(addr3.address)).toString().slice(0, 5)).to.equal("10004998399390210084704".slice(0, 5));

  });

});
