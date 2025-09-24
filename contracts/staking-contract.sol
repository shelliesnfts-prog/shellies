// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract NFTStaking is Ownable, ReentrancyGuard, ERC721Holder {
    IERC721 public nft;

    struct StakeInfo {
        uint256 tokenId;
        address owner;
        uint256 stakedAt;
    }

    mapping(uint256 => StakeInfo) public stakes;
    mapping(address => uint256[]) public stakedTokens;
    address[] public stakers;
    mapping(address => bool) public isStaker;

    event Staked(address indexed user, uint256 tokenId);
    event Unstaked(address indexed user, uint256 tokenId);

    // ---------------- CONSTRUCTOR ----------------
    constructor(address _nft, address _initialOwner) Ownable(_initialOwner) {
        nft = IERC721(_nft);
    }

    // ---------------- STAKE ----------------
    function stake(uint256 tokenId) public nonReentrant {
        require(nft.ownerOf(tokenId) == msg.sender, "Not NFT owner");
        nft.safeTransferFrom(msg.sender, address(this), tokenId);

        stakes[tokenId] = StakeInfo(tokenId, msg.sender, block.timestamp);
        stakedTokens[msg.sender].push(tokenId);

        if (!isStaker[msg.sender]) {
            isStaker[msg.sender] = true;
            stakers.push(msg.sender);
        }

        emit Staked(msg.sender, tokenId);
    }

    function stakeBatch(uint256[] calldata tokenIds) external {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            stake(tokenIds[i]);
        }
    }

    // ---------------- UNSTAKE ----------------
    function unstake(uint256 tokenId) public nonReentrant {
        require(stakes[tokenId].owner == msg.sender, "Not staker");

        delete stakes[tokenId];
        _removeStakedToken(msg.sender, tokenId);
        nft.safeTransferFrom(address(this), msg.sender, tokenId);

        if (stakedTokens[msg.sender].length == 0) {
            _removeFromStakers(msg.sender);
        }

        emit Unstaked(msg.sender, tokenId);
    }

    function unstakeBatch(uint256[] calldata tokenIds) external {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            unstake(tokenIds[i]);
        }
    }

    // ---------------- VIEW FUNCTIONS ----------------
    function getStakedTokens(address user) external view returns (uint256[] memory) {
        return stakedTokens[user];
    }

    function totalStakers() external view returns (uint256) {
        return stakers.length;
    }

    function getAllStakers() external view returns (address[] memory) {
        return stakers;
    }

    // ---------------- INTERNAL ----------------
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
}