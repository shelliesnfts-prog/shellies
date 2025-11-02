// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title GamePaymentContractINK
 * @dev Contract for handling game entry payments using INK tokens (ERC-20)
 * Players pay a fixed amount of INK tokens to play the game
 * Owner can withdraw collected tokens
 */

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract GamePaymentContractINK {
    // Fixed payment amount in INK tokens (with 18 decimals)
    // For $0.04 worth of INK, this will need to be calculated based on INK price
    // Example: If 1 INK = $1, then 0.04 INK = 40000000000000000 (0.04 * 10^18)
    uint256 public constant PAYMENT_AMOUNT = 40000000000000000; // 0.04 INK tokens
    
    // INK token contract address on Ink network
    address public immutable inkToken;
    
    // Contract owner
    address public immutable owner;
    
    // Total tokens collected
    uint256 public totalCollected;
    
    // Events
    event PaymentReceived(address indexed player, uint256 amount, uint256 timestamp);
    event FundsWithdrawn(address indexed owner, uint256 amount, uint256 timestamp);
    
    /**
     * @dev Constructor sets the owner and INK token address
     * @param _inkToken Address of the INK token contract
     */
    constructor(address _inkToken) {
        require(_inkToken != address(0), "Invalid INK token address");
        owner = msg.sender;
        inkToken = _inkToken;
    }
    
    /**
     * @dev Modifier to restrict functions to owner only
     */
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    /**
     * @dev Players call this function to pay INK tokens and play the game
     * Requires prior approval of INK tokens to this contract
     */
    function payToPlay() external {
        // Transfer INK tokens from player to this contract
        bool success = IERC20(inkToken).transferFrom(
            msg.sender,
            address(this),
            PAYMENT_AMOUNT
        );
        require(success, "INK token transfer failed");
        
        // Update total collected
        totalCollected += PAYMENT_AMOUNT;
        
        // Emit event
        emit PaymentReceived(msg.sender, PAYMENT_AMOUNT, block.timestamp);
    }
    
    /**
     * @dev Owner can withdraw all collected INK tokens
     */
    function withdraw() external onlyOwner {
        uint256 balance = IERC20(inkToken).balanceOf(address(this));
        require(balance > 0, "No tokens to withdraw");
        
        bool success = IERC20(inkToken).transfer(owner, balance);
        require(success, "Token transfer failed");
        
        emit FundsWithdrawn(owner, balance, block.timestamp);
    }
    
    /**
     * @dev Get the current INK token balance of the contract
     */
    function getBalance() external view returns (uint256) {
        return IERC20(inkToken).balanceOf(address(this));
    }
}
