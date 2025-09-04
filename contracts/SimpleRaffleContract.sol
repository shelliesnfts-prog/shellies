// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title SimpleRaffleContract
 * @dev Minimal raffle contract for deployment testing
 */
contract SimpleRaffleContract is 
    ERC721Holder, 
    AccessControl, 
    ReentrancyGuard
{
    // ============ ROLES ============
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant SERVER_ROLE = keccak256("SERVER_ROLE");
    
    // ============ RAFFLE STATES ============
    enum RaffleState {
        CREATED,
        ACTIVE, 
        COMPLETED,
        CANCELLED
    }
    
    // ============ STORAGE ============
    struct Raffle {
        address prizeToken;
        uint96 prizeTokenId;
        uint64 endTimestamp;
        RaffleState state;
        bool isNFT;
        address winner;
    }
    
    // Using uint256 for sequential database IDs
    mapping(uint256 => Raffle) public raffles;
    
    // ============ EVENTS ============
    event RaffleCreated(uint256 indexed raffleId, address indexed prizeToken, uint256 prizeTokenId, bool isNFT);
    
    // ============ CONSTRUCTOR ============
    constructor(address serverWallet) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(SERVER_ROLE, serverWallet);
    }
    
    // ============ MODIFIERS ============
    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "Admin only");
        _;
    }
    
    // ============ MAIN FUNCTIONS ============
    
    /**
     * @notice Create raffle with prize token
     * @param raffleId Sequential ID from database (1, 2, 3...)
     * @param prizeToken NFT or ERC20 contract address
     * @param tokenIdOrAmount NFT token ID or ERC20 amount
     * @param endTimestamp When raffle ends
     * @param isNFT True for NFT, false for ERC20
     */
    function createRaffle(
        uint256 raffleId,
        address prizeToken,
        uint256 tokenIdOrAmount,
        uint64 endTimestamp,
        bool isNFT
    ) external onlyAdmin nonReentrant {
        require(raffles[raffleId].prizeToken == address(0), "Raffle exists");
        require(prizeToken != address(0), "Invalid token");
        require(endTimestamp > block.timestamp, "Invalid time");
        require(tokenIdOrAmount <= type(uint96).max, "Amount too large");
        
        if (isNFT) {
            // Transfer NFT to contract
            IERC721(prizeToken).safeTransferFrom(msg.sender, address(this), tokenIdOrAmount);
        } else {
            // Transfer ERC20 tokens to contract
            IERC20(prizeToken).transferFrom(msg.sender, address(this), tokenIdOrAmount);
        }
        
        // Create raffle
        raffles[raffleId] = Raffle({
            prizeToken: prizeToken,
            prizeTokenId: uint96(tokenIdOrAmount),
            endTimestamp: endTimestamp,
            state: RaffleState.CREATED,
            isNFT: isNFT,
            winner: address(0)
        });
        
        emit RaffleCreated(raffleId, prizeToken, tokenIdOrAmount, isNFT);
    }
    
    /**
     * @notice Get raffle info
     * @param raffleId Sequential raffle ID (1, 2, 3...)
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
     * @notice Support interface (required for AccessControl)
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}