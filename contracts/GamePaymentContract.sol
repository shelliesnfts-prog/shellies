// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title GamePaymentContract
 * @dev Smart contract for handling game entry payments on Ink network
 * Players pay a dynamic amount in ETH to play the game
 * Owner can withdraw collected funds and update payment amount
 */
contract GamePaymentContract {
    // State variables
    address public owner;
    uint256 public totalCollected;
    uint256 public paymentAmount; // Dynamic payment amount
    
    // Events
    event PaymentReceived(address indexed player, uint256 amount, uint256 timestamp);
    event FundsWithdrawn(address indexed owner, uint256 amount, uint256 timestamp);
    event PaymentAmountUpdated(uint256 oldAmount, uint256 newAmount, uint256 timestamp);
    
    /**
     * @dev Modifier to restrict function access to owner only
     */
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    /**
     * @dev Constructor sets the contract deployer as the owner
     * Initializes payment amount to 0.00001 ether
     */
    constructor() {
        owner = msg.sender;
        paymentAmount = 0.00001 ether;
    }
    
    /**
     * @dev Payable function for players to pay the game entry fee
     * Validates that the payment amount meets the minimum requirement
     * Emits PaymentReceived event on success
     */
    function payToPlay() external payable {
        require(msg.value >= paymentAmount, "Insufficient payment amount");
        totalCollected += msg.value;
        emit PaymentReceived(msg.sender, msg.value, block.timestamp);
    }
    
    /**
     * @dev Allows the owner to update the payment amount
     * Only callable by the owner address
     * @param newAmount The new payment amount in wei
     * Emits PaymentAmountUpdated event on success
     */
    function updatePaymentAmount(uint256 newAmount) external onlyOwner {
        require(newAmount > 0, "Payment amount must be greater than 0");
        uint256 oldAmount = paymentAmount;
        paymentAmount = newAmount;
        emit PaymentAmountUpdated(oldAmount, newAmount, block.timestamp);
    }
    
    /**
     * @dev Returns the current payment amount
     * @return The payment amount in wei
     */
    function getPaymentAmount() external view returns (uint256) {
        return paymentAmount;
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
