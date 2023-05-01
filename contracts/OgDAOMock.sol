import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./daoSplit.sol";

contract OgDAOMock is IOgDAO {
    address[] public supportedTokens;
    address[] public supportedNFTs;

    function setSupportedTokens(address[] calldata tokens) external {
        supportedTokens = tokens;
    }

    function setSupportedNFTs(address[] calldata nfts) external {
        supportedNFTs = nfts;
    }

    // NOTE: This is a dummy implimentation that simply transfers 100%. OgDAO should calculate the propper ratio's to send to splitDao based on how many nouns are redeemed
    function transferAssets(
        address payable
    ) external returns (address[] memory) {
        payable(msg.sender).transfer(address(this).balance);

        // Transfer ERC20 tokens
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            IERC20 token = IERC20(supportedTokens[i]);
            SafeERC20.safeTransfer(
                token,
                msg.sender,
                token.balanceOf(address(this))
            );
        }

        return supportedTokens;
    }

    function getThresholdQuantity() external pure override returns (uint256) {
        return 7;
    }

    function getSupportedNFTs()
        external
        view
        override
        returns (address[] memory)
    {
        return supportedNFTs;
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    receive() external payable {}
}
