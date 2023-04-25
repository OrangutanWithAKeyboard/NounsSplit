// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

// TODO:
// - During this period regular OG DAO proposals can't be executed, to prevent race conditions between the split flow and any malicious proposals.

interface IOgDAO {
    function transferAssets(address payable to, uint256 nounsCount) external;

    function getSupportedTokens() external view returns (address[] memory);

    function getSupportedNFTs() external view returns (address[] memory);
}

contract DaoSplit is IERC721Receiver, ReentrancyGuard {
    using SafeMath for uint256;

    uint256 public constant splitThreshold = 7;
    uint256 public depositedNouns;
    uint256 public splitEndTime;

    IERC721Enumerable public nounsNFT;
    IOgDAO public ogDao;
    address public nounsDao;

    event Deposited(address indexed depositor, uint256 tokenId);
    event Withdrawn(address indexed depositor, uint256 tokenId);
    event SplitTriggered(address indexed caller);
    event SplitThresholdMet(uint256 splitEndTime);
    event Redeemed(address indexed redeemer, uint256 numNouns);

    enum Period {
        preSplit,
        splitPeriod,
        postSplit
    }

    struct DepositedNoun {
        uint256 tokenId;
        address depositor;
    }

    mapping(uint256 => DepositedNoun) public depositedNounsInfo;
    mapping(address => uint256[]) public depositorToNouns;

    constructor(address _nounsNFT, address _ogDao, address _nounsDao) {
        nounsNFT = IERC721Enumerable(_nounsNFT);
        ogDao = IOgDAO(_ogDao);
        nounsDao = _nounsDao;
    }

    modifier onlyInPostSplitPeriod() {
        require(
            currentPeriod() == Period.postSplit,
            "Not in post split period"
        );
        _;
    }

    function currentPeriod() public view returns (Period) {
        if (depositedNouns < splitThreshold) {
            return Period.preSplit;
        }
        return
            block.timestamp <= splitEndTime
                ? Period.splitPeriod
                : Period.postSplit;
    }

    // TODO: Allow for multiple deposits in one transaction
    function deposit(uint256 tokenId) external nonReentrant {
        require(
            currentPeriod() == Period.preSplit ||
                currentPeriod() == Period.splitPeriod,
            "Deposits not allowed in post split period"
        );

        nounsNFT.safeTransferFrom(msg.sender, address(this), tokenId);
        depositedNouns++;
        depositedNounsInfo[tokenId] = DepositedNoun(tokenId, msg.sender);
        depositorToNouns[msg.sender].push(tokenId);

        if (depositedNouns >= splitThreshold && splitEndTime == 0) {
            splitEndTime = block.timestamp + 7 days;
            emit SplitThresholdMet(splitEndTime);
        }

        emit Deposited(msg.sender, tokenId);
    }

    function withdraw(uint256 tokenId) external nonReentrant {
        require(
            currentPeriod() == Period.preSplit,
            "Withdrawals only allowed in pre split period"
        );
        require(
            depositedNounsInfo[tokenId].depositor == msg.sender,
            "Only the depositor can withdraw"
        );

        delete depositedNounsInfo[tokenId];
        depositedNouns--;

        uint256[] storage depositorNouns = depositorToNouns[msg.sender];
        for (uint256 i = 0; i < depositorNouns.length; i++) {
            if (depositorNouns[i] == tokenId) {
                depositorNouns[i] = depositorNouns[depositorNouns.length - 1];
                depositorNouns.pop();
                break;
            }
        }

        emit Withdrawn(msg.sender, tokenId);

        nounsNFT.safeTransferFrom(address(this), msg.sender, tokenId);
    }

    function triggerSplit() external onlyInPostSplitPeriod {
        // TODO: This could theoretically run out of gas. Talk with the team about this and make assumptions explicit.
        for (uint256 i = 0; i < depositedNouns; i++) {
            uint256 tokenId = depositorToNouns[msg.sender][i];
            nounsNFT.safeTransferFrom(address(this), nounsDao, tokenId);
        }

        ogDao.transferAssets(payable(address(this)), depositedNouns);

        emit SplitTriggered(msg.sender);
    }

    function redeem() external nonReentrant onlyInPostSplitPeriod {
        //TODO: Could add a function to ensure that triggerSplit has been called but this could also be up to the user to check.
        uint256[] storage depositorNouns = depositorToNouns[msg.sender];
        uint256 numNouns = depositorNouns.length;
        require(numNouns > 0, "No Nouns to redeem");

        // Calculate the user's share
        uint256 totalNouns = depositedNouns;
        uint256 userSharePercentage = (numNouns * 1e18) / totalNouns;

        // Transfer Ether
        uint256 etherBalance = address(this).balance;
        uint256 etherShare = (etherBalance * userSharePercentage) / 1e18;

        //TODO: is .transfer the safest way to do this?
        payable(msg.sender).transfer(etherShare);

        // Transfer ERC20 tokens
        address[] memory erc20Tokens = ogDao.getSupportedTokens();
        for (uint256 i = 0; i < erc20Tokens.length; i++) {
            IERC20 token = IERC20(erc20Tokens[i]);
            uint256 tokenBalance = token.balanceOf(address(this));
            uint256 tokenShare = (tokenBalance * userSharePercentage) / 1e18;
            //TODO: use safeTransfer
            token.transfer(msg.sender, tokenShare);
        }

        //TODO: Review erc721 transfer code below
        // Transfer ERC721 tokens
        address[] memory erc721Tokens = ogDao.getSupportedNFTs();
        for (uint256 i = 0; i < erc721Tokens.length; i++) {
            IERC721Enumerable nft = IERC721Enumerable(erc721Tokens[i]);
            uint256 nftBalance = nft.balanceOf(address(this));
            uint256 nftShare = (nftBalance * userSharePercentage) / 1e18;
            for (uint256 j = 0; j < nftShare; j++) {
                uint256 tokenId = nft.tokenOfOwnerByIndex(address(this), j);
                nft.safeTransferFrom(address(this), msg.sender, tokenId);
            }
        }

        // Remove redeemed Nouns
        delete depositorToNouns[msg.sender];

        emit Redeemed(msg.sender, numNouns);
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
