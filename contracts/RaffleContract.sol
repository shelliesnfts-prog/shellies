// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.1.0/contracts/token/ERC721/IERC721.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.1.0/contracts/token/ERC20/IERC20.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.1.0/contracts/token/ERC721/utils/ERC721Holder.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.1.0/contracts/access/extensions/AccessControlEnumerable.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.1.0/contracts/utils/ReentrancyGuard.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.1.0/contracts/utils/Pausable.sol";

/**
 * @title ShelliesRaffleContract
 * @dev Professional raffle contract with admin wallet control and optional server automation
 * @dev Updated for Phase 4: Admin wallet approach with enhanced security
 * @author Shellies Team
 */
contract ShelliesRaffleContract is 
    ERC721Holder, 
    AccessControlEnumerable, 
    ReentrancyGuard, 
    Pausable
{
    
    // ============ ROLES ============
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    // SERVER_ROLE removed - only admin-controlled raffles now
    
    // ============ RAFFLE STATES ============
    enum RaffleState {
        CREATED,        // Prize deposited, ready for entries
        ACTIVE,         // Accepting entries  
        COMPLETED,      // Winner selected and prize distributed
        CANCELLED       // Emergency cancelled by admin
    }
    
    // ============ EVENTS ============
    event RaffleCreated(uint256 indexed raffleId, address indexed prizeToken, uint256 prizeTokenId, bool isNFT);
    event RaffleStateChanged(uint256 indexed raffleId, RaffleState oldState, RaffleState newState);
    event RaffleEnded(uint256 indexed raffleId, address indexed winner, uint256 totalParticipants, uint256 totalTickets);
    event EmergencyWithdraw(uint256 indexed raffleId, address indexed admin, address prizeToken, uint256 prizeTokenId);
    
    // ============ STORAGE ============
    struct Raffle {
        address prizeToken;      // NFT/Token contract (20 bytes)
        uint96 prizeTokenId;     // NFT ID or token amount (12 bytes) 
        uint64 endTimestamp;     // End time (8 bytes)
        RaffleState state;       // Current state (1 byte)
        bool isNFT;             // NFT vs ERC20 (1 byte)
        address winner;          // Winner address (20 bytes)
    }
    
    // Main raffle storage - using uint256 for sequential database IDs
    mapping(uint256 => Raffle) public raffles;
    
    // ============ MODIFIERS ============
    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "Admin only");
        _;
    }
    
    // onlyServer modifier removed - no server wallet needed
    
    modifier raffleInState(uint256 raffleId, RaffleState expectedState) {
        require(raffles[raffleId].state == expectedState, "Invalid raffle state");
        _;
    }
    
    modifier raffleExists(uint256 raffleId) {
        require(raffles[raffleId].prizeToken != address(0), "Raffle not found");
        _;
    }
    
    // ============ CONSTRUCTOR ============
    /**
     * @dev Constructor - deployer becomes the first admin
     * @dev Only admins can create, manage, and end raffles
     */
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        // Contract deployer is the first admin and can add/remove other admins
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @notice Admin deposits NFT prize and creates raffle (Admin Wallet Approach)
     * @dev Admin must own and approve the NFT before calling this function
     * @dev This replaces the old server wallet approach for better security
     * @param raffleId Unique raffle ID from database (sequential)
     * @param prizeToken NFT contract address
     * @param tokenId NFT token ID
     * @param endTimestamp When raffle ends
     */
    function createRaffleWithNFT(
        uint256 raffleId,
        address prizeToken,
        uint256 tokenId,
        uint64 endTimestamp
    ) external onlyAdmin whenNotPaused nonReentrant {
        require(raffles[raffleId].prizeToken == address(0), "Raffle already exists");
        require(prizeToken != address(0), "Invalid token");
        require(tokenId <= type(uint96).max, "Token ID too large");
        require(endTimestamp > block.timestamp, "Invalid end time");
        
        // Transfer NFT to contract
        IERC721(prizeToken).safeTransferFrom(msg.sender, address(this), tokenId);
        
        // Create raffle with CREATED state
        raffles[raffleId] = Raffle({
            prizeToken: prizeToken,
            prizeTokenId: uint96(tokenId),
            endTimestamp: endTimestamp,
            state: RaffleState.CREATED,
            isNFT: true,
            winner: address(0)
        });
        
        emit RaffleCreated(raffleId, prizeToken, tokenId, true);
        emit RaffleStateChanged(raffleId, RaffleState.CREATED, RaffleState.CREATED);
    }
    
    /**
     * @notice Admin deposits ERC20 prize and creates raffle (Admin Wallet Approach)
     * @dev Admin must own and approve the tokens before calling this function
     * @dev This replaces the old server wallet approach for better security
     * @param raffleId Unique raffle ID from database (sequential)
     * @param prizeToken ERC20 contract address
     * @param amount Token amount to deposit
     * @param endTimestamp When raffle ends
     */
    function createRaffleWithToken(
        uint256 raffleId,
        address prizeToken,
        uint256 amount,
        uint64 endTimestamp
    ) external onlyAdmin whenNotPaused nonReentrant {
        require(raffles[raffleId].prizeToken == address(0), "Raffle already exists");
        require(prizeToken != address(0), "Invalid token");
        require(amount > 0, "Invalid amount");
        require(amount <= type(uint96).max, "Amount too large");
        require(endTimestamp > block.timestamp, "Invalid end time");
        
        // Transfer tokens to contract
        IERC20(prizeToken).transferFrom(msg.sender, address(this), amount);
        
        // Create raffle with CREATED state
        raffles[raffleId] = Raffle({
            prizeToken: prizeToken,
            prizeTokenId: uint96(amount),
            endTimestamp: endTimestamp,
            state: RaffleState.CREATED,
            isNFT: false,
            winner: address(0)
        });
        
        emit RaffleCreated(raffleId, prizeToken, amount, false);
        emit RaffleStateChanged(raffleId, RaffleState.CREATED, RaffleState.CREATED);
    }
    
    /**
     * @notice Admin activates raffle to start accepting entries (Admin Wallet Approach)
     * @dev Only the admin who created the raffle (or other admins) can activate it
     * @dev This provides better control over when raffles go live
     * @param raffleId The raffle to activate
     */
    function activateRaffle(uint256 raffleId) 
        external 
        onlyAdmin 
        raffleExists(raffleId)
        raffleInState(raffleId, RaffleState.CREATED)
    {
        raffles[raffleId].state = RaffleState.ACTIVE;
        emit RaffleStateChanged(raffleId, RaffleState.CREATED, RaffleState.ACTIVE);
    }
    
    /**
     * @notice Convenience function to create and activate NFT raffle in one transaction
     * @dev Admin must own and approve the NFT before calling this function
     * @param raffleId Unique raffle ID from database (sequential)
     * @param prizeToken NFT contract address
     * @param tokenId NFT token ID
     * @param endTimestamp When raffle ends
     */
    function createAndActivateNFTRaffle(
        uint256 raffleId,
        address prizeToken,
        uint256 tokenId,
        uint64 endTimestamp
    ) external onlyAdmin whenNotPaused nonReentrant {
        // Create the raffle
        require(raffles[raffleId].prizeToken == address(0), "Raffle already exists");
        require(prizeToken != address(0), "Invalid token");
        require(tokenId <= type(uint96).max, "Token ID too large");
        require(endTimestamp > block.timestamp, "Invalid end time");
        
        // Transfer NFT to contract
        IERC721(prizeToken).safeTransferFrom(msg.sender, address(this), tokenId);
        
        // Create and immediately activate raffle
        raffles[raffleId] = Raffle({
            prizeToken: prizeToken,
            prizeTokenId: uint96(tokenId),
            endTimestamp: endTimestamp,
            state: RaffleState.ACTIVE, // Directly to ACTIVE state
            isNFT: true,
            winner: address(0)
        });
        
        emit RaffleCreated(raffleId, prizeToken, tokenId, true);
        emit RaffleStateChanged(raffleId, RaffleState.CREATED, RaffleState.ACTIVE);
    }
    
    /**
     * @notice Convenience function to create and activate ERC20 raffle in one transaction
     * @dev Admin must own and approve the tokens before calling this function
     * @param raffleId Unique raffle ID from database (sequential)
     * @param prizeToken ERC20 contract address
     * @param amount Token amount to deposit
     * @param endTimestamp When raffle ends
     */
    function createAndActivateTokenRaffle(
        uint256 raffleId,
        address prizeToken,
        uint256 amount,
        uint64 endTimestamp
    ) external onlyAdmin whenNotPaused nonReentrant {
        // Create the raffle
        require(raffles[raffleId].prizeToken == address(0), "Raffle already exists");
        require(prizeToken != address(0), "Invalid token");
        require(amount > 0, "Invalid amount");
        require(amount <= type(uint96).max, "Amount too large");
        require(endTimestamp > block.timestamp, "Invalid end time");
        
        // Transfer tokens to contract
        IERC20(prizeToken).transferFrom(msg.sender, address(this), amount);
        
        // Create and immediately activate raffle
        raffles[raffleId] = Raffle({
            prizeToken: prizeToken,
            prizeTokenId: uint96(amount),
            endTimestamp: endTimestamp,
            state: RaffleState.ACTIVE, // Directly to ACTIVE state
            isNFT: false,
            winner: address(0)
        });
        
        emit RaffleCreated(raffleId, prizeToken, amount, false);
        emit RaffleStateChanged(raffleId, RaffleState.CREATED, RaffleState.ACTIVE);
    }
    
    // ============ USER FUNCTIONS ============
    
    /**
     * @notice Users call this to join a raffle (signature only)
     * @dev This function doesn't store data, just requires user signature for security
     * @param raffleId The raffle to join
     * @param ticketCount Number of tickets to purchase (for validation)
     */
    function joinRaffle(
        uint256 raffleId,
        uint256 ticketCount
    ) external 
        raffleExists(raffleId)
        raffleInState(raffleId, RaffleState.ACTIVE)
        whenNotPaused 
    {
        require(ticketCount > 0, "Invalid ticket count");
        require(block.timestamp < raffles[raffleId].endTimestamp, "Raffle ended");
        
        // This function intentionally does nothing except validate the raffle is active
        // and require user signature. The server will handle actual participation data.
        // This ensures users must sign a transaction to join, providing security.
    }
    
    // ============ ADMIN RAFFLE ENDING ============
    
    /**
     * @notice Admin ends raffle and selects winner
     * @dev Only admins can end raffles - no server dependency
     * @param raffleId The raffle to end
     * @param participants Array of participant addresses
     * @param ticketCounts Array of ticket counts for each participant
     * @param randomSeed Random seed for additional entropy
     */
    function endRaffle(
        uint256 raffleId,
        address[] calldata participants,
        uint256[] calldata ticketCounts,
        uint256 randomSeed
    ) external 
        onlyAdmin 
        raffleExists(raffleId)
        raffleInState(raffleId, RaffleState.ACTIVE)
        whenNotPaused 
        nonReentrant 
    {
        require(participants.length == ticketCounts.length, "Array mismatch");
        require(participants.length > 0, "No participants");
        require(block.timestamp >= raffles[raffleId].endTimestamp, "Raffle not ended yet");
        
        // Calculate total tickets and select winner
        uint256 totalTickets = 0;
        for (uint256 i = 0; i < ticketCounts.length; i++) {
            totalTickets += ticketCounts[i];
        }
        require(totalTickets > 0, "No tickets sold");
        
        // Generate secure random number using multiple entropy sources
        uint256 randomNumber = uint256(
            keccak256(abi.encodePacked(
                randomSeed,                    // Admin-provided randomness
                block.timestamp,               // Current block time
                block.prevrandao,             // Previous block randomness
                blockhash(block.number - 1),  // Previous block hash
                raffleId,                     // Unique raffle identifier
                totalTickets,                 // Total tickets for additional uniqueness
                participants.length,          // Number of participants
                tx.gasprice                   // Transaction gas price for more entropy
            ))
        );
        
        // Select winner using weighted random selection
        uint256 randomTicket = randomNumber % totalTickets;
        address winner = _selectWinnerByTicket(participants, ticketCounts, randomTicket);
        
        // Update raffle state
        Raffle storage raffle = raffles[raffleId];
        raffle.winner = winner;
        raffle.state = RaffleState.COMPLETED;
        emit RaffleStateChanged(raffleId, RaffleState.ACTIVE, RaffleState.COMPLETED);
        
        // Transfer prize to winner
        _transferPrize(raffleId, winner);
        
        emit RaffleEnded(raffleId, winner, participants.length, totalTickets);
    }
    
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @notice Get comprehensive raffle information
     */
    function getRaffleInfo(uint256 raffleId) external view returns (
        address prizeToken,
        uint256 prizeTokenId,
        uint64 endTimestamp,
        RaffleState state,
        bool isNFT,
        address winner
    ) {
        Raffle memory raffle = raffles[raffleId];
        
        return (
            raffle.prizeToken,
            raffle.prizeTokenId,
            raffle.endTimestamp,
            raffle.state,
            raffle.isNFT,
            raffle.winner
        );
    }
    
    /**
     * @notice Get raffle state
     */
    function getRaffleState(uint256 raffleId) external view returns (RaffleState) {
        return raffles[raffleId].state;
    }
    
    /**
     * @notice Check if raffle can be ended
     */
    function canEndRaffle(uint256 raffleId) external view returns (bool) {
        Raffle memory raffle = raffles[raffleId];
        return raffle.state == RaffleState.ACTIVE && 
               block.timestamp >= raffle.endTimestamp;
    }
    
    /**
     * @notice Check if raffle exists
     */
    function isRaffleActive(uint256 raffleId) external view returns (bool) {
        return raffles[raffleId].prizeToken != address(0);
    }
    
    /**
     * @notice Check contract configuration and admin status
     * @dev Returns information about admin roles and configuration
     * @return hasAdmins True if there are admins who can manage raffles
     * @return adminCount Number of addresses with ADMIN_ROLE
     * @return isCallerAdmin True if msg.sender has ADMIN_ROLE
     */
    function getContractConfiguration() external view returns (
        bool hasAdmins,
        uint256 adminCount,
        bool isCallerAdmin
    ) {
        // Check if there are any admins
        hasAdmins = getRoleMemberCount(ADMIN_ROLE) > 0;
        
        // Return admin count
        adminCount = getRoleMemberCount(ADMIN_ROLE);
        
        // Check if caller is admin
        isCallerAdmin = hasRole(ADMIN_ROLE, msg.sender);
    }
    
    /**
     * @notice Get all admin addresses
     * @dev Returns array of all addresses with ADMIN_ROLE
     * @return admins Array of admin addresses
     */
    function getAllAdmins() external view returns (address[] memory admins) {
        uint256 adminCount = getRoleMemberCount(ADMIN_ROLE);
        admins = new address[](adminCount);
        
        for (uint256 i = 0; i < adminCount; i++) {
            admins[i] = getRoleMember(ADMIN_ROLE, i);
        }
        
        return admins;
    }
    
    /**
     * @notice Check if an address is an admin
     * @param account Address to check
     * @return True if address has ADMIN_ROLE
     */
    function isAdmin(address account) external view returns (bool) {
        return hasRole(ADMIN_ROLE, account);
    }
    
    // ============ EMERGENCY FUNCTIONS ============
    
    /**
     * @notice Emergency withdraw prize (cancelled raffles only)
     */
    function emergencyWithdraw(uint256 raffleId, address recipient) 
        external 
        onlyAdmin 
        raffleExists(raffleId)
        nonReentrant 
    {
        require(recipient != address(0), "Invalid recipient");
        
        Raffle storage raffle = raffles[raffleId];
        require(raffle.state != RaffleState.COMPLETED, "Raffle completed");
        require(raffle.state != RaffleState.CANCELLED, "Already cancelled");
        
        // Mark as cancelled to prevent further operations
        RaffleState oldState = raffle.state;
        raffle.state = RaffleState.CANCELLED;
        emit RaffleStateChanged(raffleId, oldState, RaffleState.CANCELLED);
        
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
    function _transferPrize(uint256 raffleId, address winner) internal {
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
     * @notice Add new admin (existing admin only)
     * @dev Allows multiple admins to manage raffles
     * @dev Only existing admins can add new admins
     * @param newAdmin Address to grant ADMIN_ROLE
     */
    function addAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Invalid admin address");
        require(!hasRole(ADMIN_ROLE, newAdmin), "Already an admin");
        
        grantRole(ADMIN_ROLE, newAdmin);
    }
    
    /**
     * @notice Remove admin (existing admin only)
     * @dev Removes ADMIN_ROLE from specified address
     * @dev At least one admin must remain (cannot remove all admins)
     * @param admin Address to remove ADMIN_ROLE from
     */
    function removeAdmin(address admin) external onlyAdmin {
        require(admin != address(0), "Invalid admin address");
        require(hasRole(ADMIN_ROLE, admin), "Not an admin");
        require(getRoleMemberCount(ADMIN_ROLE) > 1, "Cannot remove last admin");
        
        revokeRole(ADMIN_ROLE, admin);
    }
    
    /**
     * @notice Renounce admin role (self only)
     * @dev Allows admin to remove their own admin privileges
     * @dev At least one admin must remain
     */
    function renounceAdminRole() external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Not an admin");
        require(getRoleMemberCount(ADMIN_ROLE) > 1, "Cannot remove last admin");
        
        revokeRole(ADMIN_ROLE, msg.sender);
    }

    /**
     * @notice Check interface support (required for AccessControlEnumerable)
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}