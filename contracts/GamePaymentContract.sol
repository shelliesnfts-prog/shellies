// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title GamePaymentContract
 * @dev Smart contract for handling game entry payments on Ink network
 * Players pay 0.04 USD equivalent in ETH to play the game
 * Owner can withdraw collected funds
 */
contract GamePaymentContract {
    // State variables
    address public owner;
    uint256 public totalCollected;
    uint256 public constant PAYMENT_AMOUNT = 0.00001 ether; // Adjustable based on ETH price
    
    // Events
    event PaymentReceived(address indexed player, uint256 amount, uint256 timestamp);
    event FundsWithdrawn(address indexed owner, uint256 amount, uint256 timestamp);
    
    /**
     * @dev Modifier to restrict function access to owner only
     */
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    /**
     * @dev Constructor sets the contract deployer as the owner
     */
    constructor() {
        owner = msg.sender;
    }
    
    /**
     * @dev Payable function for players to pay the game entry fee
     * Validates that the payment amount meets the minimum requirement
     * Emits PaymentReceived event on success
     */
    function payToPlay() external payable {
        require(msg.value >= PAYMENT_AMOUNT, "Insufficient payment amount");
        totalCollected += msg.value;
        emit PaymentReceived(msg.sender, msg.value, block.timestamp);
    }
    
    /**
     * @dev Allows the owner to withdraw all collected funds from the contract
     * Only callable by the owner address
     * Emits FundsWithdrawn event on success
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        
        (bool success, ) = owner.call{value: balance}("");
        require(success, "Withdrawal failed");
        
        emit FundsWithdrawn(owner, balance, block.timestamp);
    }
    
    /**
     * @dev Returns the current balance of the contract
     * @return The contract balance in wei
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
