// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title TimeLockStaking
 * @dev NFT Staking contract with time-locked periods (day/week/month)
 * @author Generated with Claude Code
 */
contract TimeLockStaking is Ownable, ReentrancyGuard, ERC721Holder {

    // ============ Enums ============

    enum LockPeriod {
        DAY,    // 1 day
        WEEK,   // 7 days
        MONTH   // 30 days
    }

    // ============ Structs ============

    struct StakeInfo {
        uint256 tokenId;
        address owner;
        uint256 stakedAt;
        uint256 lockEndTime;
        LockPeriod lockPeriod;
    }

    // ============ State Variables ============

    IERC721 public nft;

    // Lock periods in seconds
    uint256 public constant DAY_PERIOD = 1 days;
    uint256 public constant WEEK_PERIOD = 7 days;
    uint256 public constant MONTH_PERIOD = 30 days;

    // Core mappings
    mapping(uint256 => StakeInfo) public stakes;
    mapping(address => uint256[]) public stakedTokens;
    mapping(address => bool) public isStaker;

    // Tracking arrays
    address[] public stakers;

    // Emergency controls
    bool public emergencyWithdrawEnabled = false;

    // ============ Events ============

    event Staked(
        address indexed user,
        uint256 indexed tokenId,
        LockPeriod lockPeriod,
        uint256 lockEndTime
    );

    event Unstaked(
        address indexed user,
        uint256 indexed tokenId
    );

    event EmergencyWithdrawToggled(bool enabled);

    event BatchStaked(
        address indexed user,
        uint256[] tokenIds,
        LockPeriod lockPeriod,
        uint256 lockEndTime
    );

    // ============ Constructor ============

    constructor(address _nft, address _initialOwner) Ownable(_initialOwner) {
        nft = IERC721(_nft);
    }

    // ============ Staking Functions ============

    function stake(uint256 tokenId, LockPeriod lockPeriod) public nonReentrant {
        require(nft.ownerOf(tokenId) == msg.sender, "Not NFT owner");
        require(stakes[tokenId].owner == address(0), "Token already staked");

        // Calculate lock end time
        uint256 lockDuration = _getLockDuration(lockPeriod);
        uint256 lockEndTime = block.timestamp + lockDuration;

        // Transfer NFT to contract
        nft.safeTransferFrom(msg.sender, address(this), tokenId);

        // Create stake record
        stakes[tokenId] = StakeInfo(
            tokenId,
            msg.sender,
            block.timestamp,
            lockEndTime,
            lockPeriod
        );

        // Update user's staked tokens
        stakedTokens[msg.sender].push(tokenId);

        // Update staker status
        if (!isStaker[msg.sender]) {
            isStaker[msg.sender] = true;
            stakers.push(msg.sender);
        }

        emit Staked(msg.sender, tokenId, lockPeriod, lockEndTime);
    }

    function stakeBatch(uint256[] calldata tokenIds, LockPeriod lockPeriod) external {
        require(tokenIds.length > 0, "No tokens provided");

        uint256 lockDuration = _getLockDuration(lockPeriod);
        uint256 lockEndTime = block.timestamp + lockDuration;

        for (uint256 i = 0; i < tokenIds.length; i++) {
            stake(tokenIds[i], lockPeriod);
        }

        emit BatchStaked(msg.sender, tokenIds, lockPeriod, lockEndTime);
    }

    // ============ Unstaking Functions ============

    function unstake(uint256 tokenId) public nonReentrant {
        require(stakes[tokenId].owner == msg.sender, "Not staker");
        require(block.timestamp >= stakes[tokenId].lockEndTime, "Token still locked");

        // Clear stake record
        delete stakes[tokenId];

        // Remove from user's staked tokens
        _removeStakedToken(msg.sender, tokenId);

        // Update staker status if no more tokens
        if (stakedTokens[msg.sender].length == 0) {
            _removeFromStakers(msg.sender);
        }

        // Return NFT
        nft.safeTransferFrom(address(this), msg.sender, tokenId);

        emit Unstaked(msg.sender, tokenId);
    }

    function unstakeBatch(uint256[] calldata tokenIds) external {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            unstake(tokenIds[i]);
        }
    }

    function emergencyUnstake(uint256 tokenId) external nonReentrant {
        require(emergencyWithdrawEnabled, "Emergency withdraw disabled");
        require(stakes[tokenId].owner == msg.sender, "Not staker");

        // Clear stake record
        delete stakes[tokenId];

        // Remove from user's staked tokens
        _removeStakedToken(msg.sender, tokenId);

        // Update staker status if no more tokens
        if (stakedTokens[msg.sender].length == 0) {
            _removeFromStakers(msg.sender);
        }

        // Return NFT
        nft.safeTransferFrom(address(this), msg.sender, tokenId);

        emit Unstaked(msg.sender, tokenId);
    }

    // ============ View Functions ============

    function getStakedTokens(address user) external view returns (uint256[] memory) {
        return stakedTokens[user];
    }

    function totalStakers() external view returns (uint256) {
        return stakers.length;
    }

    function getAllStakers() external view returns (address[] memory) {
        return stakers;
    }

    function canUnstake(uint256 tokenId) external view returns (bool canUnstake, uint256 timeRemaining) {
        if (stakes[tokenId].owner == address(0)) {
            return (false, 0);
        }

        if (block.timestamp >= stakes[tokenId].lockEndTime) {
            return (true, 0);
        }

        return (false, stakes[tokenId].lockEndTime - block.timestamp);
    }

    // ============ Utility Functions ============

    function _getLockDuration(LockPeriod lockPeriod) internal pure returns (uint256) {
        if (lockPeriod == LockPeriod.DAY) return DAY_PERIOD;
        if (lockPeriod == LockPeriod.WEEK) return WEEK_PERIOD;
        if (lockPeriod == LockPeriod.MONTH) return MONTH_PERIOD;
        revert("Invalid lock period");
    }

    function _removeStakedToken(address user, uint256 tokenId) internal {
        uint256[] storage tokens = stakedTokens[user];
        uint256 length = tokens.length;

        for (uint256 i = 0; i < length; i++) {
            if (tokens[i] == tokenId) {
                tokens[i] = tokens[length - 1];
                tokens.pop();
                break;
            }
        }
    }

    function _removeFromStakers(address user) internal {
        isStaker[user] = false;
        uint256 length = stakers.length;
        for (uint256 i = 0; i < length; i++) {
            if (stakers[i] == user) {
                stakers[i] = stakers[length - 1];
                stakers.pop();
                break;
            }
        }
    }

    // ============ Admin Functions ============

    function setEmergencyWithdraw(bool enabled) external onlyOwner {
        emergencyWithdrawEnabled = enabled;
        emit EmergencyWithdrawToggled(enabled);
    }
}