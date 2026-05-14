// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
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

contract ShelliesPoints is ERC20, Ownable, ReentrancyGuard {
    using ECDSA for bytes32;

    // ── Cooldown Tracking ────────────────────────────────────────────────────

    mapping(address => uint256) public lastClaim;
    mapping(uint256 => bool)    public usedNonces;
    mapping(address => bool)    public operators;

    // ── Paid Claim Per-Category Cooldown Tracking ──────────────────────────────

    mapping(address => uint256) public lastClaimStakerTier;
    mapping(address => uint256) public lastClaimHolderTier;
    mapping(address => uint256) public lastClaimRegularTier;

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

    // ── Paid Claim Config (Tiered) ──────────────────────────────────────────────

    uint8   public constant CATEGORY_REGULAR = 0;
    uint8   public constant CATEGORY_HOLDER  = 1;
    uint8   public constant CATEGORY_STAKER  = 2;

    // Cost per tier (ETH fee)
    uint256 public stakerTierCost;
    uint256 public holderTierCost;
    uint256 public regularTierCost;

    // Points per staked NFT (combined, not by period) and per held NFT
    uint256 public pointsPerStakedNFT;
    uint256 public pointsPerHeldNFT;

    // Fixed reward for regular users (no NFTs)
    uint256 public rewardPerRegularUser;

    // Per-category cooldowns (seconds, 0 = no cooldown)
    uint256 public stakerTierCooldown;
    uint256 public holderTierCooldown;
    uint256 public regularTierCooldown;

    // ── XP Conversion Config ─────────────────────────────────────────────────

    uint256 public xpConversionRate;           // XP per point (e.g. 10 XP = 1 pt)
    uint256 public minXpToConvert;             // minimum XP required to convert

    // ── Hard Cap (one-shot) ──────────────────────────────────────────────────

    uint256 public maxSupply;                  // hard cap on totalSupply (0 = uncapped/unset)
    bool    public maxSupplySet;               // true once cap has been locked

    // ── Events ───────────────────────────────────────────────────────────────

    event InitialSupplySet(uint256 cap);
    event Claimed(address indexed user, uint256 points, uint256 timestamp);
    event ClaimedWithFees(address indexed user, uint8 category, uint256 points, uint256 feePaid);
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
        address _authorizedSigner,
        uint256 _initialSupply
    ) ERC20("Shellies Points", "SPTS") Ownable(msg.sender) {
        require(_stakingContract != address(0), "Zero staking contract");
        require(_nftContract != address(0), "Zero NFT contract");
        require(_authorizedSigner != address(0), "Zero authorized signer");

        stakingContract   = _stakingContract;
        nftContract       = _nftContract;
        authorizedSigner  = _authorizedSigner;

        if (_initialSupply > 0) {
            maxSupply    = _initialSupply;
            maxSupplySet = true;
            emit InitialSupplySet(_initialSupply);
        }

        // Free claim defaults
        claimCooldown             = 86400; // 24 h
        pointsForRegularUser      = 1;
        pointsPerAvailableNFT     = 5;
        pointsPerDailyStakedNFT   = 7;
        pointsPerWeeklyStakedNFT  = 10;
        pointsPerMonthlyStakedNFT = 20;
        maxPointsPerClaim         = 2000;

        // Paid claim defaults — owner must set cost before enabling
        stakerTierCost   = 0;
        holderTierCost   = 0;
        regularTierCost  = 0;
        pointsPerStakedNFT = 0;
        pointsPerHeldNFT   = 0;
        rewardPerRegularUser = 0;
        stakerTierCooldown = 0;
        holderTierCooldown = 0;
        regularTierCooldown = 0;

        // XP conversion defaults
        xpConversionRate = 10;
        minXpToConvert   = 100;
    }

    // ── ERC20 Overrides ──────────────────────────────────────────────────────

    /// @dev Points use whole numbers — no fractional display.
    function decimals() public pure override returns (uint8) { return 0; }

    /// @dev Soulbound — minting (from == 0) and burning (to == 0) are allowed;
    ///      all peer-to-peer transfers are blocked. Mints are capped at maxSupply
    ///      (when set). Burns free up cap room — re-mintable.
    function _update(address from, address to, uint256 amount) internal override {
        require(from == address(0) || to == address(0), "SPTS: non-transferable");
        if (from == address(0) && maxSupplySet) {
            require(totalSupply() + amount <= maxSupply, "SPTS: cap exceeded");
        }
        super._update(from, to, amount);
    }

    // ── Compatibility Shim ───────────────────────────────────────────────────

    /// @dev The deployed raffle contract calls IShelliesPoints.balances(user).
    ///      This wrapper keeps it working without redeploying the raffle contract.
    function balances(address user) external view returns (uint256) {
        return balanceOf(user);
    }

    // ── User Category Helper ─────────────────────────────────────────────────

    function getUserCategory(address user) public view returns (uint8) {
        if (ITimeLockStaking(stakingContract).getStakedTokens(user).length > 0) {
            return CATEGORY_STAKER;
        }
        if (IERC721Minimal(nftContract).balanceOf(user) > 0) {
            return CATEGORY_HOLDER;
        }
        return CATEGORY_REGULAR;
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

        lastClaim[msg.sender] = block.timestamp;
        _mint(msg.sender, points);

        emit Claimed(msg.sender, points, block.timestamp);
    }

    // ── Paid Claim (Tiered - Dynamic) ─────────────────────────────────────────

    function claimWithFees() external payable nonReentrant {
        uint8 category = getUserCategory(msg.sender);

        uint256 cost;
        uint256 cooldown;
        uint256 lastClaimTime;

        if (category == CATEGORY_STAKER) {
            cost = stakerTierCost;
            cooldown = stakerTierCooldown;
            lastClaimTime = lastClaimStakerTier[msg.sender];

            require(cost > 0, "Staker tier: cost not configured");
            require(pointsPerStakedNFT > 0, "Staker tier: reward not configured");

        } else if (category == CATEGORY_HOLDER) {
            cost = holderTierCost;
            cooldown = holderTierCooldown;
            lastClaimTime = lastClaimHolderTier[msg.sender];

            require(cost > 0, "Holder tier: cost not configured");
            require(pointsPerHeldNFT > 0, "Holder tier: reward not configured");

        } else {
            cost = regularTierCost;
            cooldown = regularTierCooldown;
            lastClaimTime = lastClaimRegularTier[msg.sender];

            require(cost > 0, "Regular tier: cost not configured");
            require(rewardPerRegularUser > 0, "Regular tier: reward not configured");
        }

        require(msg.value >= cost, "Insufficient fee");

        if (cooldown > 0) {
            require(
                block.timestamp >= lastClaimTime + cooldown,
                "Paid claim cooldown not elapsed"
            );
        }

        uint256 excess = msg.value - cost;
        uint256 reward;

        if (category == CATEGORY_STAKER) {
            uint256[] memory stakedIds = ITimeLockStaking(stakingContract).getStakedTokens(msg.sender);
            reward = stakedIds.length * pointsPerStakedNFT;
            lastClaimStakerTier[msg.sender] = block.timestamp;

        } else if (category == CATEGORY_HOLDER) {
            uint256 heldNFTs = IERC721Minimal(nftContract).balanceOf(msg.sender);
            reward = heldNFTs * pointsPerHeldNFT;
            lastClaimHolderTier[msg.sender] = block.timestamp;

        } else {
            reward = rewardPerRegularUser;
            lastClaimRegularTier[msg.sender] = block.timestamp;
        }

        _mint(msg.sender, reward);

        if (excess > 0) {
            (bool ok,) = msg.sender.call{value: excess}("");
            require(ok, "Refund failed");
        }

        emit ClaimedWithFees(msg.sender, category, reward, cost);
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

        usedNonces[nonce] = true;
        uint256 pointsToAward = xpAmount / xpConversionRate;
        require(pointsToAward > 0, "XP too low for even 1 point at current rate");
        _mint(msg.sender, pointsToAward);

        emit XpConverted(msg.sender, xpAmount, pointsToAward, nonce);
    }

    // ── Spend (operator-only) ─────────────────────────────────────────────────

    function spend(address user, uint256 amount) external onlyOperator nonReentrant {
        require(amount > 0, "Amount must be > 0");
        _burn(user, amount);
        emit PointsSpent(user, amount, msg.sender);
    }

    // ── Admin Mint / Burn ────────────────────────────────────────────────────

    function adminMint(address user, uint256 amount) external onlyOwner {
        require(user != address(0), "Zero address");
        require(amount > 0,         "Amount must be > 0");
        _mint(user, amount);
        emit AdminMint(user, amount);
    }

    function adminBurn(address user, uint256 amount) external onlyOwner {
        require(user != address(0), "Zero address");
        require(amount > 0,         "Amount must be > 0");
        _burn(user, amount);
        emit AdminBurn(user, amount);
    }

    // ── Initial Supply / Hard Cap (one-shot, owner-only) ─────────────────────

    /// @notice Owner sets the initial (max) supply post-deployment. Callable once.
    /// @dev    Locks `maxSupply = amount`. All future mints (claim, claimWithFees,
    ///         convertXp, adminMint) revert if they would push totalSupply past
    ///         this cap. Burns reduce totalSupply and free up room for re-mints.
    function setInitialSupply(uint256 amount) external onlyOwner {
        require(!maxSupplySet, "Initial supply already set");
        require(amount > 0,    "Amount must be > 0");
        require(amount >= totalSupply(), "Cap below current supply");
        maxSupply    = amount;
        maxSupplySet = true;
        emit InitialSupplySet(amount);
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

    // ── Config Setters — Paid Claim (Tiered) ───────────────────────────────────

    function setStakerTierCost(uint256 amount) external onlyOwner {
        stakerTierCost = amount;
        emit ConfigUpdated("stakerTierCost", amount);
    }

    function setHolderTierCost(uint256 amount) external onlyOwner {
        holderTierCost = amount;
        emit ConfigUpdated("holderTierCost", amount);
    }

    function setRegularTierCost(uint256 amount) external onlyOwner {
        regularTierCost = amount;
        emit ConfigUpdated("regularTierCost", amount);
    }

    function setPointsPerStakedNFT(uint256 amount) external onlyOwner {
        pointsPerStakedNFT = amount;
        emit ConfigUpdated("pointsPerStakedNFT", amount);
    }

    function setPointsPerHeldNFT(uint256 amount) external onlyOwner {
        pointsPerHeldNFT = amount;
        emit ConfigUpdated("pointsPerHeldNFT", amount);
    }

    function setRewardPerRegularUser(uint256 amount) external onlyOwner {
        rewardPerRegularUser = amount;
        emit ConfigUpdated("rewardPerRegularUser", amount);
    }

    function setStakerTierCooldown(uint256 seconds_) external onlyOwner {
        stakerTierCooldown = seconds_;
        emit ConfigUpdated("stakerTierCooldown", seconds_);
    }

    function setHolderTierCooldown(uint256 seconds_) external onlyOwner {
        holderTierCooldown = seconds_;
        emit ConfigUpdated("holderTierCooldown", seconds_);
    }

    function setRegularTierCooldown(uint256 seconds_) external onlyOwner {
        regularTierCooldown = seconds_;
        emit ConfigUpdated("regularTierCooldown", seconds_);
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
