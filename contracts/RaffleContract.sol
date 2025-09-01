// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title ShelliesRaffleContract
 * @dev Ultra-optimized raffle contract with server automation
 * @author Shellies Team
 */
contract ShelliesRaffleContract is ERC721Holder, AccessControl, ReentrancyGuard, Pausable {
    
    // ============ ROLES ============
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant SERVER_ROLE = keccak256("SERVER_ROLE");
    
    // ============ EVENTS ============
    event RaffleCreated(bytes32 indexed raffleId, address indexed prizeToken, uint256 prizeTokenId, bool isNFT, uint64 endTimestamp);
    event RaffleEnded(bytes32 indexed raffleId, address indexed winner, uint256 totalParticipants, uint256 totalTickets);
    event EmergencyWithdraw(bytes32 indexed raffleId, address indexed admin, address prizeToken, uint256 prizeTokenId);
    
    // ============ STORAGE ============
    struct Raffle {
        address prizeToken;      // NFT/Token contract (20 bytes)
        uint96 prizeTokenId;     // NFT ID or token amount (12 bytes) 
        uint64 endTimestamp;     // End time (8 bytes)
        address winner;          // Winner address (20 bytes)
        bool isNFT;             // NFT vs ERC20 (1 byte)
        bool completed;          // Finished flag (1 byte)
    }
    
    mapping(bytes32 => Raffle) public raffles;
    mapping(bytes32 => bool) public raffleExists;
    
    // ============ MODIFIERS ============
    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "Admin only");
        _;
    }
    
    modifier onlyServer() {
        require(hasRole(SERVER_ROLE, msg.sender), "Server only");
        _;
    }
    
    modifier raffleActive(bytes32 raffleId) {
        require(raffleExists[raffleId], "Raffle not found");
        require(!raffles[raffleId].completed, "Raffle completed");
        require(block.timestamp < raffles[raffleId].endTimestamp, "Raffle expired");
        _;
    }
    
    modifier raffleEnded(bytes32 raffleId) {
        require(raffleExists[raffleId], "Raffle not found");
        require(block.timestamp >= raffles[raffleId].endTimestamp, "Raffle still active");
        require(!raffles[raffleId].completed, "Already completed");
        _;
    }
    
    // ============ CONSTRUCTOR ============
    constructor(address serverWallet) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(SERVER_ROLE, serverWallet);
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @notice Create raffle and deposit NFT prize in one transaction
     * @param raffleId Unique raffle ID from database
     * @param prizeToken NFT contract address
     * @param tokenId NFT token ID
     * @param endTimestamp When raffle ends
     */
    function createRaffleWithNFT(
        bytes32 raffleId,
        address prizeToken,
        uint256 tokenId,
        uint64 endTimestamp
    ) external onlyAdmin whenNotPaused nonReentrant {
        require(!raffleExists[raffleId], "Raffle exists");
        require(prizeToken != address(0), "Invalid token");
        require(endTimestamp > block.timestamp, "Invalid end time");
        require(tokenId <= type(uint96).max, "Token ID too large");
        
        // Transfer NFT to contract
        IERC721(prizeToken).safeTransferFrom(msg.sender, address(this), tokenId);
        
        // Store raffle data (gas optimized)
        raffles[raffleId] = Raffle({
            prizeToken: prizeToken,
            prizeTokenId: uint96(tokenId),
            endTimestamp: endTimestamp,
            winner: address(0),
            isNFT: true,
            completed: false
        });
        
        raffleExists[raffleId] = true;
        
        emit RaffleCreated(raffleId, prizeToken, tokenId, true, endTimestamp);
    }
    
    /**
     * @notice Create raffle and deposit ERC20 prize in one transaction
     * @param raffleId Unique raffle ID from database
     * @param prizeToken ERC20 contract address
     * @param amount Token amount to deposit
     * @param endTimestamp When raffle ends
     */
    function createRaffleWithToken(
        bytes32 raffleId,
        address prizeToken,
        uint256 amount,
        uint64 endTimestamp
    ) external onlyAdmin whenNotPaused nonReentrant {
        require(!raffleExists[raffleId], "Raffle exists");
        require(prizeToken != address(0), "Invalid token");
        require(amount > 0, "Invalid amount");
        require(amount <= type(uint96).max, "Amount too large");
        require(endTimestamp > block.timestamp, "Invalid end time");
        
        // Transfer tokens to contract
        IERC20(prizeToken).transferFrom(msg.sender, address(this), amount);
        
        // Store raffle data
        raffles[raffleId] = Raffle({
            prizeToken: prizeToken,
            prizeTokenId: uint96(amount),
            endTimestamp: endTimestamp,
            winner: address(0),
            isNFT: false,
            completed: false
        });
        
        raffleExists[raffleId] = true;
        
        emit RaffleCreated(raffleId, prizeToken, amount, false, endTimestamp);
    }
    
    // ============ SERVER FUNCTIONS ============
    
    /**
     * @notice Server calls this to end raffle and select winner
     * @param raffleId The raffle to end
     * @param participants Array of participant addresses
     * @param ticketCounts Array of ticket counts for each participant
     * @param entropy Random seed from server
     */
    function endRaffle(
        bytes32 raffleId,
        address[] calldata participants,
        uint256[] calldata ticketCounts,
        uint256 entropy
    ) external onlyServer raffleEnded(raffleId) whenNotPaused nonReentrant {
        require(participants.length == ticketCounts.length, "Array mismatch");
        require(participants.length > 0, "No participants");
        
        Raffle storage raffle = raffles[raffleId];
        
        // Calculate total tickets and select winner
        uint256 totalTickets = 0;
        for (uint256 i = 0; i < ticketCounts.length; i++) {
            totalTickets += ticketCounts[i];
        }
        
        require(totalTickets > 0, "No tickets sold");
        
        // Generate random ticket number using server entropy + block data
        uint256 randomTicket = uint256(
            keccak256(abi.encodePacked(
                entropy,
                block.timestamp,
                block.difficulty,
                raffleId,
                totalTickets
            ))
        ) % totalTickets;
        
        // Find winner by ticket ranges
        address winner = _selectWinnerByTicket(participants, ticketCounts, randomTicket);
        
        // Update raffle state
        raffle.winner = winner;
        raffle.completed = true;
        
        // Transfer prize to winner
        _transferPrize(raffleId, winner);
        
        emit RaffleEnded(raffleId, winner, participants.length, totalTickets);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @notice Get raffle information
     */
    function getRaffle(bytes32 raffleId) external view returns (
        address prizeToken,
        uint256 prizeTokenId,
        uint64 endTimestamp,
        address winner,
        bool isNFT,
        bool completed,
        bool isActive
    ) {
        require(raffleExists[raffleId], "Raffle not found");
        
        Raffle memory raffle = raffles[raffleId];
        
        return (
            raffle.prizeToken,
            raffle.prizeTokenId,
            raffle.endTimestamp,
            raffle.winner,
            raffle.isNFT,
            raffle.completed,
            block.timestamp < raffle.endTimestamp && !raffle.completed
        );
    }
    
    /**
     * @notice Check if raffle is ready to be ended
     */
    function canEndRaffle(bytes32 raffleId) external view returns (bool) {
        if (!raffleExists[raffleId]) return false;
        
        Raffle memory raffle = raffles[raffleId];
        return block.timestamp >= raffle.endTimestamp && !raffle.completed;
    }
    
    // ============ EMERGENCY FUNCTIONS ============
    
    /**
     * @notice Emergency withdraw prize (cancelled raffles only)
     */
    function emergencyWithdraw(bytes32 raffleId, address recipient) 
        external onlyAdmin nonReentrant 
    {
        require(raffleExists[raffleId], "Raffle not found");
        require(!raffles[raffleId].completed, "Raffle completed");
        require(recipient != address(0), "Invalid recipient");
        
        Raffle storage raffle = raffles[raffleId];
        
        // Mark as completed to prevent double withdrawal
        raffle.completed = true;
        
        // Transfer prize back
        if (raffle.isNFT) {
            IERC721(raffle.prizeToken).safeTransferFrom(
                address(this), 
                recipient, 
                raffle.prizeTokenId
            );
        } else {
            IERC20(raffle.prizeToken).transfer(recipient, raffle.prizeTokenId);
        }
        
        emit EmergencyWithdraw(raffleId, recipient, raffle.prizeToken, raffle.prizeTokenId);
    }
    
    /**
     * @notice Pause contract in emergency
     */
    function pause() external onlyAdmin {
        _pause();
    }
    
    /**
     * @notice Unpause contract
     */
    function unpause() external onlyAdmin {
        _unpause();
    }
    
    // ============ INTERNAL FUNCTIONS ============
    
    /**
     * @notice Select winner based on weighted random selection
     */
    function _selectWinnerByTicket(
        address[] calldata participants,
        uint256[] calldata ticketCounts,
        uint256 randomTicket
    ) internal pure returns (address) {
        uint256 currentPosition = 0;
        
        for (uint256 i = 0; i < participants.length; i++) {
            currentPosition += ticketCounts[i];
            if (randomTicket < currentPosition) {
                return participants[i];
            }
        }
        
        // Fallback (should never happen)
        return participants[participants.length - 1];
    }
    
    /**
     * @notice Transfer prize to winner
     */
    function _transferPrize(bytes32 raffleId, address winner) internal {
        Raffle memory raffle = raffles[raffleId];
        
        if (raffle.isNFT) {
            IERC721(raffle.prizeToken).safeTransferFrom(
                address(this),
                winner,
                raffle.prizeTokenId
            );
        } else {
            IERC20(raffle.prizeToken).transfer(winner, raffle.prizeTokenId);
        }
    }
    
    // ============ ADMIN ROLE MANAGEMENT ============
    
    /**
     * @notice Add server wallet (admin only)
     */
    function addServerWallet(address serverWallet) external onlyAdmin {
        grantRole(SERVER_ROLE, serverWallet);
    }
    
    /**
     * @notice Remove server wallet (admin only)
     */
    function removeServerWallet(address serverWallet) external onlyAdmin {
        revokeRole(SERVER_ROLE, serverWallet);
    }
}