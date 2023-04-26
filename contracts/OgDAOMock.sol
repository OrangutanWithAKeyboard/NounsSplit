// contracts/OgDAOMock.sol

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./daoSplit.sol";

contract OgDAOMock is IOgDAO {
    address[] private _supportedTokens;
    address[] private _supportedNFTs;

    function setSupportedTokens(address[] calldata tokens) external {
        _supportedTokens = tokens;
    }

    function setSupportedNFTs(address[] calldata nfts) external {
        _supportedNFTs = nfts;
    }

    function transferAssets(address payable, uint256) external override {}

    function getThresholdQuantity() external pure override returns (uint256) {
        return 7;
    }

    function getSupportedTokens()
        external
        view
        override
        returns (address[] memory)
    {
        return _supportedTokens;
    }

    function getSupportedNFTs()
        external
        view
        override
        returns (address[] memory)
    {
        return _supportedNFTs;
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
