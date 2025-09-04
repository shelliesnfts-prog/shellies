// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title FixedSimpleRaffleContract
 * @dev Fixed minimal raffle contract for deployment testing
 */
contract FixedSimpleRaffleContract is AccessControl {
    
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
        uint256 prizeAmount;
        uint64 endTimestamp;
        RaffleState state;
        bool isNFT;
        address winner;
    }
    
    mapping(uint256 => Raffle) public raffles;
    
    // ============ EVENTS ============
    event RaffleCreated(uint256 indexed raffleId, address indexed prizeToken, uint256 prizeAmount, bool isNFT);
    
    // ============ CONSTRUCTOR ============
    constructor(address serverWallet) {
        require(serverWallet != address(0), "Invalid server wallet");
        
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
     * @notice Create raffle (simplified - no token transfers for testing)
     */
    function createRaffle(
        uint256 raffleId,
        address prizeToken,
        uint256 prizeAmount,
        uint64 endTimestamp,
        bool isNFT
    ) external onlyAdmin {
        require(raffles[raffleId].prizeToken == address(0), "Raffle exists");
        require(prizeToken != address(0), "Invalid token");
        require(endTimestamp > block.timestamp, "Invalid time");
        
        raffles[raffleId] = Raffle({
            prizeToken: prizeToken,
            prizeAmount: prizeAmount,
            endTimestamp: endTimestamp,
            state: RaffleState.CREATED,
            isNFT: isNFT,
            winner: address(0)
        });
        
        emit RaffleCreated(raffleId, prizeToken, prizeAmount, isNFT);
    }
    
    /**
     * @notice Get raffle info
     */
    function getRaffleInfo(uint256 raffleId) external view returns (
        address prizeToken,
        uint256 prizeAmount,
        uint64 endTimestamp,
        RaffleState state,
        bool isNFT,
        address winner
    ) {
        Raffle memory raffle = raffles[raffleId];
        
        return (
            raffle.prizeToken,
            raffle.prizeAmount,
            raffle.endTimestamp,
            raffle.state,
            raffle.isNFT,
            raffle.winner
        );
    }
    
    /**
     * @notice Support interface (required for AccessControl)
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}