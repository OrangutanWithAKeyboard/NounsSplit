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
}
