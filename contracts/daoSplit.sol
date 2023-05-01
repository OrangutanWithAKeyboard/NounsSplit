// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

interface IOgDAO is IERC721Receiver {
    function transferAssets(
        address payable to
    ) external returns (address[] memory);

    function getSupportedNFTs() external view returns (address[] memory);

    // This is a function in the OG DAO contract that we need to call to get the current threshold of nouns which excludes the ones that are in OgDAO's treasury.
    function getThresholdQuantity() external view returns (uint256);
}

contract DaoSplit is IERC721Receiver, ReentrancyGuard {
    using SafeMath for uint256;

    uint256 public depositedNouns;
    uint256 public redeemedNouns;
    uint256 public splitEndTime;
    address[] public redeemableERC20s;

    IERC721Enumerable public nounsNFT;
    IOgDAO public ogDao;

    event Deposited(address indexed depositor, uint256[] tokenIds);
    event Withdrawn(address indexed depositor, uint256 tokenId);
    event SplitTriggered(address indexed caller);
    event SplitThresholdMet(uint256 splitEndTime);
    event Redeemed(address indexed redeemer, uint256 numNouns);
    event SplitNounsMoved(uint256[] nounsArr);

    enum Period {
        preSplit,
        splitPeriod,
        postSplit
    }

    struct DepositedNoun {
        uint256 tokenId;
        address depositor;
        string reason;
    }

    mapping(uint256 => DepositedNoun) public depositedNounsInfo;
    mapping(address => uint256[]) public depositorToNouns;

    constructor(address _nounsNFT, address _ogDao) {
        nounsNFT = IERC721Enumerable(_nounsNFT);
        ogDao = IOgDAO(_ogDao);
    }

    modifier onlyInPostSplitPeriod() {
        require(
            currentPeriod() == Period.postSplit,
            "Not in post split period"
        );
        _;
    }

    function currentPeriod() public view returns (Period) {
        if (depositedNouns < getSplitThreshold()) {
            return Period.preSplit;
        }
        return
            block.timestamp <= splitEndTime
                ? Period.splitPeriod
                : Period.postSplit;
    }

    function getSplitThreshold() public view returns (uint256) {
        return ogDao.getThresholdQuantity();
    }

    // Allows users to deposit multiple NFTs into the contract and associate a reason for depositing
    function deposit(
        uint256[] memory tokenIds,
        string memory reason
    ) external nonReentrant {
        require(
            currentPeriod() != Period.postSplit,
            "Deposits not allowed in post split period"
        );

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];

            nounsNFT.safeTransferFrom(msg.sender, address(this), tokenId);
            depositedNouns++;
            depositedNounsInfo[tokenId] = DepositedNoun(
                tokenId,
                msg.sender,
                reason
            );
            depositorToNouns[msg.sender].push(tokenId);
        }

        if (depositedNouns >= getSplitThreshold() && splitEndTime == 0) {
            splitEndTime = block.timestamp + 7 days;
            emit SplitThresholdMet(splitEndTime);
        }

        emit Deposited(msg.sender, tokenIds);
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

    // Can be called in batches with specific tokenIds to move nouns to the OG DAO.
    // Moves Nouns from this contract to the OG DAO, only allowed in the post-split period
    function triggerSplitMoveNouns(
        uint256[] memory nounsArr
    ) external onlyInPostSplitPeriod {
        require(nounsArr.length > 0, "Invalid nouns array");

        for (uint256 i = 0; i < nounsArr.length; i++) {
            nounsNFT.safeTransferFrom(
                address(this),
                address(ogDao),
                nounsArr[i]
            );
        }

        emit SplitNounsMoved(nounsArr);
    }

    // Request the OG DAO to transfer the correct assets to this split DAO contract, only allowed in the post-split period
    function triggerSplit() external onlyInPostSplitPeriod {
        uint256 balance = nounsNFT.balanceOf(address(this));
        require(balance == 0, "Nouns still in contract");

        // TODO: needs to be implimented on OG DAO's side
        redeemableERC20s = ogDao.transferAssets(payable(address(this)));

        emit SplitTriggered(msg.sender);
    }

    // Redeems the user's share of assets based on their deposited NFTs, only allowed in the post-split period
    function redeem() external nonReentrant onlyInPostSplitPeriod {
        //TODO: Could add a function to ensure that triggerSplit has been called but this could also be up to the user to check
        uint256[] storage depositorNouns = depositorToNouns[msg.sender];
        uint256 numNouns = depositorNouns.length;
        require(numNouns > 0, "No Nouns to redeem");

        // Calculate the user's share
        uint256 userSharePercentage = (numNouns * 1e18) /
            (depositedNouns - redeemedNouns);

        // Transfer Ether
        uint256 etherBalance = address(this).balance;
        uint256 etherShare = (etherBalance * userSharePercentage) / 1e18;

        //TODO: is .transfer the safest way to do this?
        payable(msg.sender).transfer(etherShare);

        // Transfer ERC20 tokens
        for (uint256 i = 0; i < redeemableERC20s.length; i++) {
            IERC20 token = IERC20(redeemableERC20s[i]);
            uint256 tokenBalance = token.balanceOf(address(this));
            uint256 tokenShare = (tokenBalance * userSharePercentage) / 1e18;
            SafeERC20.safeTransfer(token, msg.sender, tokenShare);
        }

        redeemedNouns += numNouns;

        // Remove redeemed Nouns
        delete depositorToNouns[msg.sender];

        emit Redeemed(msg.sender, numNouns);
    }

    // Implements the IERC721Receiver interface for receiving ERC721 tokens
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    // TODO: Should this be nonReentrant?
    receive() external payable {}
}
