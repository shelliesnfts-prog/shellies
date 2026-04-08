// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface ITimeLockStaking {
    enum LockPeriod { DAY, WEEK, MONTH }

    function getStakedTokens(address user) external view returns (uint256[] memory);

    function stakes(uint256 tokenId) external view returns (
        uint256 tokenId_,
        address owner_,
        uint256 stakedAt,
        uint256 lockEndTime,
        LockPeriod lockPeriod
    );

    function isStaker(address user) external view returns (bool);
}

interface IERC721Minimal {
    function balanceOf(address owner) external view returns (uint256);
}

// ─── ShelliesPoints ──────────────────────────────────────────────────────────

contract ShelliesPoints is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;

    // ── Balances & Cooldown Tracking ─────────────────────────────────────────

    mapping(address => uint256) public balances;
    mapping(address => uint256) public lastClaim;
    mapping(address => uint256) public lastClaimWithFees;
    mapping(uint256 => bool)    public usedNonces;
    mapping(address => bool)    public operators;

    // ── Roles ─────────────────────────────────────────────────────────────────

    address public authorizedSigner;

    // ── External Contracts ───────────────────────────────────────────────────

    address public stakingContract;
    address public nftContract;

    // ── Free Claim Config ────────────────────────────────────────────────────

    uint256 public claimCooldown;              // seconds between free claims
    uint256 public pointsForRegularUser;       // points for wallets with no NFTs
    uint256 public pointsPerAvailableNFT;      // points per NFT held in wallet
    uint256 public pointsPerDailyStakedNFT;    // points per DAY-staked NFT
    uint256 public pointsPerWeeklyStakedNFT;   // points per WEEK-staked NFT
    uint256 public pointsPerMonthlyStakedNFT;  // points per MONTH-staked NFT
    uint256 public maxPointsPerClaim;          // hard cap per claim

    // ── Paid Claim Config ────────────────────────────────────────────────────

    uint256 public claimWithFeesReward;        // points awarded per paid claim
    uint256 public claimWithFeesCost;          // wei required per paid claim
    uint256 public claimWithFeesCooldown;      // seconds between paid claims (0 = no cooldown)

    // ── XP Conversion Config ─────────────────────────────────────────────────

    uint256 public xpConversionRate;           // XP per point (e.g. 10 XP = 1 pt)
    uint256 public minXpToConvert;             // minimum XP required to convert

    // ── Events ───────────────────────────────────────────────────────────────

    event Claimed(address indexed user, uint256 points, uint256 timestamp);
    event ClaimedWithFees(address indexed user, uint256 points, uint256 feePaid);
    event XpConverted(address indexed user, uint256 xpAmount, uint256 points, uint256 nonce);
    event PointsSpent(address indexed user, uint256 amount, address indexed spender);
    event AdminMint(address indexed user, uint256 amount);
    event AdminBurn(address indexed user, uint256 amount);
    event FeesWithdrawn(address indexed to, uint256 amount);
    event ConfigUpdated(string param, uint256 value);
    event ConfigAddressUpdated(string param, address value);
    event OperatorUpdated(address indexed operator, bool status);

    // ── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOperator() {
        require(operators[msg.sender], "Caller is not an operator");
        _;
    }

    // ── Constructor ──────────────────────────────────────────────────────────

    constructor(
        address _stakingContract,
        address _nftContract,
        address _authorizedSigner
    ) Ownable(msg.sender) {
        require(_stakingContract != address(0), "Zero staking contract");
        require(_nftContract != address(0), "Zero NFT contract");
        require(_authorizedSigner != address(0), "Zero authorized signer");

        stakingContract   = _stakingContract;
        nftContract       = _nftContract;
        authorizedSigner  = _authorizedSigner;

        // Free claim defaults
        claimCooldown             = 86400; // 24 h
        pointsForRegularUser      = 1;
        pointsPerAvailableNFT     = 5;
        pointsPerDailyStakedNFT   = 7;
        pointsPerWeeklyStakedNFT  = 10;
        pointsPerMonthlyStakedNFT = 20;
        maxPointsPerClaim         = 2000;

        // Paid claim defaults — owner must set cost & reward before enabling
        claimWithFeesReward   = 0;
        claimWithFeesCost     = 0;
        claimWithFeesCooldown = 0;

        // XP conversion defaults
        xpConversionRate = 10;
        minXpToConvert   = 100;
    }

    // ── Free Claim ───────────────────────────────────────────────────────────

    function claim() external nonReentrant {
        require(
            block.timestamp >= lastClaim[msg.sender] + claimCooldown,
            "Cooldown not elapsed"
        );

        // NFTs held in wallet (staked NFTs live in the staking contract, already excluded)
        uint256 availableNFTs = IERC721Minimal(nftContract).balanceOf(msg.sender);

        // Staked NFTs classified by lock period
        uint256[] memory stakedIds = ITimeLockStaking(stakingContract).getStakedTokens(msg.sender);
        uint256 daily;
        uint256 weekly;
        uint256 monthly;

        for (uint256 i = 0; i < stakedIds.length; i++) {
            (,,,, ITimeLockStaking.LockPeriod period) =
                ITimeLockStaking(stakingContract).stakes(stakedIds[i]);
            if      (period == ITimeLockStaking.LockPeriod.DAY)   daily++;
            else if (period == ITimeLockStaking.LockPeriod.WEEK)  weekly++;
            else if (period == ITimeLockStaking.LockPeriod.MONTH) monthly++;
        }

        uint256 totalNFTs = availableNFTs + stakedIds.length;
        uint256 points;

        if (totalNFTs == 0) {
            points = pointsForRegularUser;
        } else {
            points = (availableNFTs * pointsPerAvailableNFT)
                   + (daily         * pointsPerDailyStakedNFT)
                   + (weekly        * pointsPerWeeklyStakedNFT)
                   + (monthly       * pointsPerMonthlyStakedNFT);
        }

        if (points > maxPointsPerClaim) points = maxPointsPerClaim;

        // Effects — state before emit
        lastClaim[msg.sender]   = block.timestamp;
        balances[msg.sender]   += points;

        emit Claimed(msg.sender, points, block.timestamp);
    }

    // ── Paid Claim ───────────────────────────────────────────────────────────

    function claimWithFees() external payable nonReentrant {
        require(claimWithFeesCost > 0,   "Paid claim: cost not configured");
        require(claimWithFeesReward > 0, "Paid claim: reward not configured");
        require(msg.value >= claimWithFeesCost, "Insufficient fee");

        if (claimWithFeesCooldown > 0) {
            require(
                block.timestamp >= lastClaimWithFees[msg.sender] + claimWithFeesCooldown,
                "Paid claim cooldown not elapsed"
            );
            lastClaimWithFees[msg.sender] = block.timestamp;
        }

        uint256 excess = msg.value - claimWithFeesCost;

        // Effects
        balances[msg.sender] += claimWithFeesReward;

        // Refund excess after state update
        if (excess > 0) {
            (bool ok,) = msg.sender.call{value: excess}("");
            require(ok, "Refund failed");
        }

        emit ClaimedWithFees(msg.sender, claimWithFeesReward, claimWithFeesCost);
    }

    // ── XP Conversion ────────────────────────────────────────────────────────

    function convertXp(
        uint256 xpAmount,
        uint256 nonce,
        uint256 expiry,
        bytes calldata signature
    ) external nonReentrant {
        require(block.timestamp <= expiry,  "Voucher expired");
        require(!usedNonces[nonce],         "Nonce already used");
        require(xpAmount >= minXpToConvert, "Below minimum XP");
        require(xpConversionRate > 0,       "Conversion rate not configured");

        bytes32 messageHash = keccak256(abi.encodePacked(
            msg.sender,
            xpAmount,
            nonce,
            expiry,
            block.chainid
        ));
        bytes32 ethSignedHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            messageHash
        ));
        address recovered = ECDSA.recover(ethSignedHash, signature);
        require(recovered == authorizedSigner, "Invalid signature");

        // Effects
        usedNonces[nonce] = true;
        uint256 pointsToAward = xpAmount / xpConversionRate;
        require(pointsToAward > 0, "XP too low for even 1 point at current rate");
        balances[msg.sender] += pointsToAward;

        emit XpConverted(msg.sender, xpAmount, pointsToAward, nonce);
    }

    // ── Spend (operator-only) ─────────────────────────────────────────────────

    function spend(address user, uint256 amount) external onlyOperator nonReentrant {
        require(amount > 0,               "Amount must be > 0");
        require(balances[user] >= amount, "Insufficient points balance");
        balances[user] -= amount;
        emit PointsSpent(user, amount, msg.sender);
    }

    // ── Admin Mint / Burn ────────────────────────────────────────────────────

    function adminMint(address user, uint256 amount) external onlyOwner {
        require(user != address(0), "Zero address");
        require(amount > 0,         "Amount must be > 0");
        balances[user] += amount;
        emit AdminMint(user, amount);
    }

    function adminBurn(address user, uint256 amount) external onlyOwner {
        require(user != address(0),        "Zero address");
        require(amount > 0,                "Amount must be > 0");
        require(balances[user] >= amount,  "Balance too low to burn");
        balances[user] -= amount;
        emit AdminBurn(user, amount);
    }

    // ── Fee Withdrawal ───────────────────────────────────────────────────────

    function withdrawFees() external onlyOwner {
        uint256 bal = address(this).balance;
        require(bal > 0, "Nothing to withdraw");
        (bool ok,) = owner().call{value: bal}("");
        require(ok, "Withdraw failed");
        emit FeesWithdrawn(owner(), bal);
    }

    // ── Config Setters — Free Claim ──────────────────────────────────────────

    function setClaimCooldown(uint256 seconds_) external onlyOwner {
        claimCooldown = seconds_;
        emit ConfigUpdated("claimCooldown", seconds_);
    }

    function setPointsForRegularUser(uint256 amount) external onlyOwner {
        pointsForRegularUser = amount;
        emit ConfigUpdated("pointsForRegularUser", amount);
    }

    function setPointsPerAvailableNFT(uint256 amount) external onlyOwner {
        pointsPerAvailableNFT = amount;
        emit ConfigUpdated("pointsPerAvailableNFT", amount);
    }

    function setPointsPerDailyStakedNFT(uint256 amount) external onlyOwner {
        pointsPerDailyStakedNFT = amount;
        emit ConfigUpdated("pointsPerDailyStakedNFT", amount);
    }

    function setPointsPerWeeklyStakedNFT(uint256 amount) external onlyOwner {
        pointsPerWeeklyStakedNFT = amount;
        emit ConfigUpdated("pointsPerWeeklyStakedNFT", amount);
    }

    function setPointsPerMonthlyStakedNFT(uint256 amount) external onlyOwner {
        pointsPerMonthlyStakedNFT = amount;
        emit ConfigUpdated("pointsPerMonthlyStakedNFT", amount);
    }

    function setMaxPointsPerClaim(uint256 amount) external onlyOwner {
        maxPointsPerClaim = amount;
        emit ConfigUpdated("maxPointsPerClaim", amount);
    }

    // ── Config Setters — Paid Claim ───────────────────────────────────────────

    function setClaimWithFeesReward(uint256 amount) external onlyOwner {
        claimWithFeesReward = amount;
        emit ConfigUpdated("claimWithFeesReward", amount);
    }

    function setClaimWithFeesCost(uint256 weiAmount) external onlyOwner {
        claimWithFeesCost = weiAmount;
        emit ConfigUpdated("claimWithFeesCost", weiAmount);
    }

    function setClaimWithFeesCooldown(uint256 seconds_) external onlyOwner {
        claimWithFeesCooldown = seconds_;
        emit ConfigUpdated("claimWithFeesCooldown", seconds_);
    }

    // ── Config Setters — XP Conversion ───────────────────────────────────────

    function setXpConversionRate(uint256 rate) external onlyOwner {
        require(rate > 0, "Rate must be > 0");
        xpConversionRate = rate;
        emit ConfigUpdated("xpConversionRate", rate);
    }

    function setMinXpToConvert(uint256 amount) external onlyOwner {
        minXpToConvert = amount;
        emit ConfigUpdated("minXpToConvert", amount);
    }

    function setAuthorizedSigner(address signer) external onlyOwner {
        require(signer != address(0), "Zero address");
        authorizedSigner = signer;
        emit ConfigAddressUpdated("authorizedSigner", signer);
    }

    // ── Config Setters — Contract Refs & Roles ───────────────────────────────

    function setStakingContract(address addr) external onlyOwner {
        require(addr != address(0), "Zero address");
        stakingContract = addr;
        emit ConfigAddressUpdated("stakingContract", addr);
    }

    function setNFTContract(address addr) external onlyOwner {
        require(addr != address(0), "Zero address");
        nftContract = addr;
        emit ConfigAddressUpdated("nftContract", addr);
    }

    function setOperator(address addr, bool status) external onlyOwner {
        require(addr != address(0), "Zero address");
        operators[addr] = status;
        emit OperatorUpdated(addr, status);
    }
}
