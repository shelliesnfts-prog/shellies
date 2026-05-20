// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface IShelliesPoints {
    function spend(address user, uint256 amount) external;
    function balances(address user) external view returns (uint256);
}

/**
 * @title NewShelliesRaffleContract
 * @dev Held-NFT-only raffle contract. Admin must transfer the NFT into this
 *      contract BEFORE calling createRaffle — the contract verifies ownership
 *      then registers and activates the raffle in a single transaction.
 *      No approve-based flow. No ERC20 prizes. No separate activate step.
 * @author Shellies Team
 */
contract NewShelliesRaffleContract is
    ERC721Holder,
    AccessControlEnumerable,
    ReentrancyGuard,
    Pausable
{
    // ============ ROLES ============
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // ============ RAFFLE STATES ============
    enum RaffleState {
        CREATED,     // unused in this contract — kept for event-log compatibility
        ACTIVE,      // accepting entries
        COMPLETED,   // winner selected and prize distributed
        CANCELLED    // emergency cancelled by admin
    }

    // ============ STORAGE ============

    struct Raffle {
        address prizeToken;        // NFT contract address                  (20 bytes)
        uint96  prizeTokenId;      // NFT token ID                          (12 bytes) — slot 1
        uint96  pointsPerTicket;   // ShelliesPoints cost per ticket        (12 bytes)
        RaffleState state;         // current state                         ( 1 byte)
        bool    isNFT;             // always true — kept for ABI parity     ( 1 byte)  — slot 2
        address winner;            // winner address                        (20 bytes) — slot 3
    }

    mapping(uint256 => Raffle) public raffles;
    mapping(address => mapping(uint256 => bool)) public assignedPrizeNFTs;

    /// @notice Deployed ShelliesPoints contract used for ticket payment.
    address public shelliesPointsContract;

    // ============ EVENTS ============

    event RaffleCreated(
        uint256 indexed raffleId,
        address indexed prizeToken,
        uint256 prizeTokenId,
        bool    isNFT,
        uint256 pointsPerTicket
    );
    event RaffleStateChanged(uint256 indexed raffleId, RaffleState oldState, RaffleState newState);
    event RaffleEnded(uint256 indexed raffleId, address indexed winner, uint256 totalParticipants, uint256 totalTickets);
    event RaffleEntered(uint256 indexed raffleId, address indexed participant, uint256 ticketCount, uint256 pointsSpent);
    event EmergencyWithdraw(uint256 indexed raffleId, address indexed admin, address prizeToken, uint256 prizeTokenId);
    event UnassignedNFTRescued(address indexed admin, address indexed recipient, address indexed prizeToken, uint256 prizeTokenId);
    event ShelliesPointsContractUpdated(address indexed oldContract, address indexed newContract);

    // ============ MODIFIERS ============

    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "Admin only");
        _;
    }

    modifier raffleInState(uint256 raffleId, RaffleState expectedState) {
        require(raffles[raffleId].state == expectedState, "Invalid raffle state");
        _;
    }

    modifier raffleExists(uint256 raffleId) {
        require(raffles[raffleId].prizeToken != address(0), "Raffle not found");
        _;
    }

    // ============ CONSTRUCTOR ============

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    // ============ SHELLIESPOINTS CONFIG ============

    /**
     * @notice Set the ShelliesPoints contract address used for ticket payments.
     * @dev Set to address(0) to disable on-chain point spending (entries become free).
     */
    function setShelliesPointsContract(address _contract) external onlyAdmin {
        emit ShelliesPointsContractUpdated(shelliesPointsContract, _contract);
        shelliesPointsContract = _contract;
    }

    // ============ ADMIN: RAFFLE CREATION (HELD-NFT ONLY) ============

    /**
     * @notice Register an NFT (already escrowed in this contract) as a new raffle prize
     *         and immediately activate the raffle.
     * @dev Admin must transfer the NFT to this contract address BEFORE calling.
     *      Reverts if the contract does not currently own the NFT, mirroring the
     *      "Raffle already exists" check from the old flow.
     * @param raffleId         Must match the sequential ID in the database.
     * @param prizeToken       ERC-721 contract address.
     * @param tokenId          NFT token ID — must already be owned by this contract.
     * @param _pointsPerTicket ShelliesPoints cost per ticket (mirrors DB points_per_ticket).
     */
    function createRaffle(
        uint256 raffleId,
        address prizeToken,
        uint256 tokenId,
        uint256 _pointsPerTicket
    ) external onlyAdmin whenNotPaused nonReentrant {
        require(raffles[raffleId].prizeToken == address(0), "Raffle already exists");
        require(prizeToken != address(0), "Invalid token");
        require(tokenId <= type(uint96).max, "Token ID too large");
        require(_pointsPerTicket > 0, "Points per ticket must be > 0");
        require(_pointsPerTicket <= type(uint96).max, "Points per ticket too large");
        require(!assignedPrizeNFTs[prizeToken][tokenId], "NFT already assigned");
        require(
            IERC721(prizeToken).ownerOf(tokenId) == address(this),
            "NFT not held by contract"
        );

        assignedPrizeNFTs[prizeToken][tokenId] = true;

        raffles[raffleId] = Raffle({
            prizeToken:      prizeToken,
            prizeTokenId:    uint96(tokenId),
            pointsPerTicket: uint96(_pointsPerTicket),
            state:           RaffleState.ACTIVE,
            isNFT:           true,
            winner:          address(0)
        });

        emit RaffleCreated(raffleId, prizeToken, tokenId, true, _pointsPerTicket);
        emit RaffleStateChanged(raffleId, RaffleState.CREATED, RaffleState.ACTIVE);
    }

    // ============ USER: JOIN RAFFLE ============

    /**
     * @notice Join an active raffle by spending ShelliesPoints.
     * @dev Deducts `ticketCount * raffle.pointsPerTicket` from msg.sender via ShelliesPoints.spend().
     *      Emits RaffleEntered so the backend indexes the entry into Supabase.
     *      All other limits (max_tickets_per_user, max_participants, end_date) are
     *      enforced by the backend API before this tx is submitted.
     */
    function joinRaffle(
        uint256 raffleId,
        uint256 ticketCount
    ) external raffleExists(raffleId) raffleInState(raffleId, RaffleState.ACTIVE) whenNotPaused nonReentrant {
        require(ticketCount > 0, "Invalid ticket count");
        require(shelliesPointsContract != address(0), "Points contract not configured");

        uint256 totalCost = ticketCount * uint256(raffles[raffleId].pointsPerTicket);
        require(totalCost > 0, "Points per ticket not configured for this raffle");

        IShelliesPoints(shelliesPointsContract).spend(msg.sender, totalCost);

        emit RaffleEntered(raffleId, msg.sender, ticketCount, totalCost);
    }

    // ============ VIEW FUNCTIONS ============

    function getRaffleInfo(uint256 raffleId) external view returns (
        address prizeToken,
        uint256 prizeTokenId,
        RaffleState state,
        bool isNFT,
        address winner,
        uint256 pointsPerTicket
    ) {
        Raffle memory r = raffles[raffleId];
        return (r.prizeToken, r.prizeTokenId, r.state, r.isNFT, r.winner, r.pointsPerTicket);
    }

    function getEntryCost(uint256 raffleId, uint256 ticketCount) external view returns (uint256) {
        return ticketCount * uint256(raffles[raffleId].pointsPerTicket);
    }

    function getRaffleState(uint256 raffleId) external view returns (RaffleState) {
        return raffles[raffleId].state;
    }

    function canEndRaffle(uint256 raffleId) external view returns (bool) {
        return raffles[raffleId].state == RaffleState.ACTIVE;
    }

    function isRaffleActive(uint256 raffleId) external view returns (bool) {
        return raffles[raffleId].prizeToken != address(0);
    }

    function getContractConfiguration() external view returns (
        bool    hasAdmins,
        uint256 adminCount,
        bool    isCallerAdmin,
        address pointsContract
    ) {
        hasAdmins      = getRoleMemberCount(ADMIN_ROLE) > 0;
        adminCount     = getRoleMemberCount(ADMIN_ROLE);
        isCallerAdmin  = hasRole(ADMIN_ROLE, msg.sender);
        pointsContract = shelliesPointsContract;
    }

    function getAllAdmins() external view returns (address[] memory admins) {
        uint256 count = getRoleMemberCount(ADMIN_ROLE);
        admins = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            admins[i] = getRoleMember(ADMIN_ROLE, i);
        }
    }

    function isAdmin(address account) external view returns (bool) {
        return hasRole(ADMIN_ROLE, account);
    }

    // ============ ADMIN: RAFFLE ENDING ============

    function endRaffle(
        uint256 raffleId,
        address[] calldata participants,
        uint256[] calldata ticketCounts,
        uint256 randomSeed
    ) external onlyAdmin raffleExists(raffleId) raffleInState(raffleId, RaffleState.ACTIVE) whenNotPaused nonReentrant {
        require(participants.length == ticketCounts.length, "Array mismatch");

        if (participants.length == 0) {
            raffles[raffleId].state = RaffleState.COMPLETED;
            emit RaffleStateChanged(raffleId, RaffleState.ACTIVE, RaffleState.COMPLETED);
            emit RaffleEnded(raffleId, address(0), 0, 0);
            return;
        }

        uint256 totalTickets;
        for (uint256 i = 0; i < ticketCounts.length; i++) {
            totalTickets += ticketCounts[i];
        }
        require(totalTickets > 0, "No tickets sold");

        uint256 randomNumber = uint256(keccak256(abi.encodePacked(
            randomSeed,
            block.timestamp,
            block.prevrandao,
            blockhash(block.number - 1),
            raffleId,
            totalTickets,
            participants.length,
            tx.gasprice
        )));

        uint256 randomTicket = randomNumber % totalTickets;
        address winner = _selectWinnerByTicket(participants, ticketCounts, randomTicket);

        raffles[raffleId].winner = winner;
        raffles[raffleId].state  = RaffleState.COMPLETED;
        emit RaffleStateChanged(raffleId, RaffleState.ACTIVE, RaffleState.COMPLETED);

        _transferPrize(raffleId, winner);

        emit RaffleEnded(raffleId, winner, participants.length, totalTickets);
    }

    // ============ ADMIN: REFUND / EMERGENCY ============

    function refundNFT(uint256 raffleId, address recipient)
        external onlyAdmin raffleExists(raffleId) nonReentrant
    {
        require(recipient != address(0), "Invalid recipient");
        Raffle storage raffle = raffles[raffleId];
        require(raffle.state == RaffleState.COMPLETED, "Raffle not completed");
        require(raffle.winner == address(0), "Raffle has winner");
        assignedPrizeNFTs[raffle.prizeToken][raffle.prizeTokenId] = false;
        IERC721(raffle.prizeToken).safeTransferFrom(address(this), recipient, raffle.prizeTokenId);
        emit EmergencyWithdraw(raffleId, recipient, raffle.prizeToken, raffle.prizeTokenId);
    }

    function emergencyWithdraw(uint256 raffleId, address recipient)
        external onlyAdmin raffleExists(raffleId) nonReentrant
    {
        require(recipient != address(0), "Invalid recipient");
        Raffle storage raffle = raffles[raffleId];
        require(raffle.state != RaffleState.COMPLETED, "Raffle completed");
        require(raffle.state != RaffleState.CANCELLED,  "Already cancelled");

        RaffleState oldState = raffle.state;
        raffle.state = RaffleState.CANCELLED;
        emit RaffleStateChanged(raffleId, oldState, RaffleState.CANCELLED);

        assignedPrizeNFTs[raffle.prizeToken][raffle.prizeTokenId] = false;
        IERC721(raffle.prizeToken).safeTransferFrom(address(this), recipient, raffle.prizeTokenId);

        emit EmergencyWithdraw(raffleId, recipient, raffle.prizeToken, raffle.prizeTokenId);
    }

    function rescueUnassignedNFT(address prizeToken, uint256 tokenId, address recipient)
        external onlyAdmin nonReentrant
    {
        require(prizeToken != address(0), "Invalid token");
        require(recipient != address(0), "Invalid recipient");
        require(!assignedPrizeNFTs[prizeToken][tokenId], "NFT assigned to raffle");
        require(IERC721(prizeToken).ownerOf(tokenId) == address(this), "NFT not held by contract");

        IERC721(prizeToken).safeTransferFrom(address(this), recipient, tokenId);
        emit UnassignedNFTRescued(msg.sender, recipient, prizeToken, tokenId);
    }

    function pause()   external onlyAdmin { _pause(); }
    function unpause() external onlyAdmin { _unpause(); }

    // ============ ADMIN ROLE MANAGEMENT ============

    function addAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Invalid admin address");
        require(!hasRole(ADMIN_ROLE, newAdmin), "Already an admin");
        grantRole(ADMIN_ROLE, newAdmin);
    }

    function removeAdmin(address admin) external onlyAdmin {
        require(admin != address(0), "Invalid admin address");
        require(hasRole(ADMIN_ROLE, admin), "Not an admin");
        require(getRoleMemberCount(ADMIN_ROLE) > 1, "Cannot remove last admin");
        revokeRole(ADMIN_ROLE, admin);
    }

    function renounceAdminRole() external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Not an admin");
        require(getRoleMemberCount(ADMIN_ROLE) > 1, "Cannot remove last admin");
        revokeRole(ADMIN_ROLE, msg.sender);
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // ============ INTERNAL ============

    function _selectWinnerByTicket(
        address[] calldata participants,
        uint256[] calldata ticketCounts,
        uint256 randomTicket
    ) internal pure returns (address) {
        uint256 position;
        for (uint256 i = 0; i < participants.length; i++) {
            position += ticketCounts[i];
            if (randomTicket < position) return participants[i];
        }
        return participants[participants.length - 1];
    }

    function _transferPrize(uint256 raffleId, address winner) internal {
        Raffle memory r = raffles[raffleId];
        assignedPrizeNFTs[r.prizeToken][r.prizeTokenId] = false;
        IERC721(r.prizeToken).safeTransferFrom(address(this), winner, r.prizeTokenId);
    }
}
