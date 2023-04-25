# DAO Split Contract Documentation

## Overview

The `DaoSplit` contract is designed to handle a split of assets between the original DAO and a new DAO, based on the deposited Nouns tokens. The contract allows users to deposit their Nouns tokens, triggering a split once a specific threshold is met. After the split, users can redeem their share of the split assets based on the number of Nouns they have deposited.

## Dependencies

The contract imports several OpenZeppelin contracts and interfaces:

- `IERC20.sol`: Interface for ERC20 tokens.
- `IERC721.sol`: Interface for ERC721 tokens.
- `IERC721Receiver.sol`: Interface for contracts that can receive ERC721 tokens.
- `IERC721Enumerable.sol`: Interface for enumerable ERC721 tokens.
- `ReentrancyGuard.sol`: Reentrancy attack protection.
- `SafeMath.sol`: Library for safe arithmetic operations.

Additionally, it uses the `IOgDAO` interface to interact with the original DAO.

## Contract Definition

The `DaoSplit` contract inherits from `IERC721Receiver` and `ReentrancyGuard`.

```solidity
contract DaoSplit is IERC721Receiver, ReentrancyGuard {
```

## Constants

The contract defines the following constant:

- `splitThreshold`: A constant `uint256` representing the threshold of deposited Nouns required to trigger a split.

## State Variables

The contract uses the following state variables:

- `depositedNouns`: A `uint256` representing the total number of deposited Nouns.
- `splitEndTime`: A `uint256` representing the end time of the split period.
- `nounsNFT`: An `IERC721Enumerable` instance representing the Nouns NFT contract.
- `ogDao`: An `IOgDAO` instance representing the original DAO contract.
- `nounsDao`: An `address` representing the new DAO contract.

## Events

The contract emits the following events:

- `Deposited`: Emitted when a user deposits a Noun.
- `Withdrawn`: Emitted when a user withdraws a Noun.
- `SplitTriggered`: Emitted when the split is triggered.
- `SplitThresholdMet`: Emitted when the deposited Nouns reach the split threshold.
- `Redeemed`: Emitted when a user redeems their share of the split assets.

## Enums

The contract defines the following enum:

- `Period`: Represents the different periods of the contract lifecycle: `preSplit`, `splitPeriod`, and `postSplit`.

## Structs

The contract defines the following struct:

- `DepositedNoun`: Contains a Noun's token ID and the address of the depositor.

## Mappings

The contract has the following mappings:

- `depositedNounsInfo`: Maps a token ID to its `DepositedNoun` struct.
- `depositorToNouns`: Maps a depositor's address to an array of their deposited Noun token IDs.

## Constructor

The constructor takes three parameters: `_nounsNFT`, `_ogDao`, and `_nounsDao` and initializes the respective state variables.

## Modifiers

The contract has a single modifier:

- `onlyInPostSplitPeriod`: Ensures that the function is only called during the post-split period.

## Functions

### View Functions

- `currentPeriod()`: Returns the current period of the contract lifecycle.

### External Functions

- `deposit(uint256 tokenId)`: Allows a user to deposit a Noun token.
- `withdraw(uint256 tokenId)`: Allows a user to withdraw a deposited Noun token before the split.
- `triggerSplit()`: Triggers the split of assets between the original DAO and the new DAO.
- `redeem()`: Allows a user to redeem their share of the split assets based on the number of Nouns they have deposited.

### Interface Functions

- `onERC721Received(address, address, uint256, bytes calldata)`: Implementation of the `IERC721Receiver` interface, allowing the contract to receive ERC721 tokens.

## Function Details

### deposit()

This function allows a user to deposit a Noun token into the contract. It checks whether the current period is `preSplit` or `splitPeriod` before proceeding. The function transfers the Noun token from the user to the contract and increments the `depositedNouns` counter. It also stores the depositor's address and token ID in the `depositedNounsInfo` mapping and the `depositorToNouns` mapping.

If the number of deposited Nouns reaches the `splitThreshold` and `splitEndTime` is not set, the function sets the `splitEndTime` to the current block timestamp plus 7 days and emits the `SplitThresholdMet` event.

### withdraw()

This function allows a user to withdraw a Noun token they have deposited before the split. It checks if the current period is `preSplit` and ensures that the caller is the depositor of the token. The function then deletes the token information from the `depositedNounsInfo` mapping, decrements the `depositedNouns` counter, and removes the token ID from the `depositorToNouns` mapping. Finally, it transfers the Noun token back to the user and emits the `Withdrawn` event.

### triggerSplit()

This function triggers the asset split between the original DAO and the new DAO. It can only be called during the post-split period. The function transfers all deposited Nouns to the new DAO and calls the `transferAssets` function of the original DAO to transfer the assets to the contract. It then emits the `SplitTriggered` event.

### redeem()

This function allows a user to redeem their share of the split assets based on the number of Nouns they have deposited. It can only be called during the post-split period. The function calculates the user's share percentage and transfers Ether, ERC20 tokens, and ERC721 tokens according to the calculated share. It also removes the redeemed Nouns from the `depositorToNouns` mapping and emits the `Redeemed` event.

### onERC721Received()

This function implements the `IERC721Receiver` interface, allowing the contract to receive ERC721 tokens. It returns the function selector of `onERC721Received`.

## TODOs

The contract includes several TODO comments, which indicate potential areas of improvement or points that require further discussion:

- Implementing a gas-optimized solution for the `triggerSplit()` function.
- Allowing multiple deposits in a single transaction.
- Ensuring `triggerSplit()` has been called before `redeem()` is executed.
- Reviewing the safety of the `.transfer` method used to send Ether.
- Using `safeTransfer` for ERC20 tokens.
- Reviewing and potentially optimizing the ERC721 transfer code.

## Conclusion

The `DaoSplit` contract provides a comprehensive solution for handling a split of assets between two DAOs based on deposited Nouns tokens. The contract allows users to deposit and withdraw Nouns, trigger the split, and redeem their share of the split assets. It includes extensive checks for the different periods of the contract lifecycle and utilizes multiple OpenZeppelin contracts and libraries to ensure a secure implementation.