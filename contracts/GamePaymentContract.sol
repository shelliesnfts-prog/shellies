// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title GamePaymentContract
 * @dev Smart contract for handling game entry payments on Ink network
 * Players pay any amount in ETH to play the game
 * Owner can withdraw collected funds
 */
contract GamePaymentContract {
    // State variables
    address public owner;
    uint256 public totalCollected;
    
    // Events
    event PaymentReceived(address indexed player, uint256 amount, uint256 timestamp);
    event XPConversionPayment(address indexed player, uint256 amount, uint256 timestamp);
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
     * Accepts any payment amount sent from the application
     * Emits PaymentReceived event on success
     */
    function payToPlay() external payable {
        totalCollected += msg.value;
        emit PaymentReceived(msg.sender, msg.value, block.timestamp);
    }
    
    /**
     * @dev Payable function for players to pay for XP to Points conversion
     * Accepts any payment amount (typically ~0.1 USD in ETH)
     * Emits XPConversionPayment event on success
     * The event allows backend to track conversion payments separately from game payments
     */
    function payToConvertXP() external payable {
        require(msg.value > 0, "Payment amount must be greater than 0");
        totalCollected += msg.value;
        emit XPConversionPayment(msg.sender, msg.value, block.timestamp);
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
