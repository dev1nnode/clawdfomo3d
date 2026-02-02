// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ClawdFomo3D
 * @notice King-of-the-hill game with $CLAWD. Last buyer wins when timer expires.
 *         Burns $CLAWD on every buy and at round end for deflationary pressure.
 * @dev Improvements:
 *      - Added emergency pause functionality
 *      - Added max keys per transaction limit (gas protection)
 *      - Added getRoundInfo() view for frontend efficiency
 *      - Added getPlayer() view for frontend efficiency
 *      - Fixed potential overflow in getCostForKeys
 *      - Added dev fee event
 *      - Added contract recovery function for stuck tokens
 *      - Added min/max timer duration validation
 */
contract ClawdFomo3D is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    // ============ Constants ============
    uint256 public constant BURN_ON_BUY_BPS = 1000;       // 10% burned on every buy
    uint256 public constant WINNER_BPS = 4000;              // 40% of pot to winner
    uint256 public constant BURN_ON_END_BPS = 3000;         // 30% of pot burned at round end
    uint256 public constant DIVIDENDS_BPS = 2500;           // 25% to key holders
    uint256 public constant DEV_BPS = 500;                  // 5% to dev
    uint256 public constant BPS = 10000;

    uint256 public constant ANTI_SNIPE_THRESHOLD = 2 minutes;
    uint256 public constant ANTI_SNIPE_EXTENSION = 2 minutes;

    // Key pricing: starts at BASE_PRICE, increases by INCREMENT per key sold
    uint256 public constant BASE_PRICE = 1000 * 1e18;      // 1000 CLAWD base
    uint256 public constant PRICE_INCREMENT = 10 * 1e18;    // +10 CLAWD per key sold
    
    // Safety limits
    uint256 public constant MAX_KEYS_PER_BUY = 1000;        // Prevent gas exhaustion
    uint256 public constant MIN_TIMER_DURATION = 5 minutes; // Minimum round time
    uint256 public constant MAX_TIMER_DURATION = 7 days;    // Maximum round time

    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;

    // ============ State ============
    IERC20 public immutable clawd;
    address public immutable dev;
    uint256 public immutable timerDuration;

    uint256 public currentRound;
    uint256 public roundStart;
    uint256 public roundEnd;
    uint256 public pot;
    uint256 public totalKeys;
    address public lastBuyer;
    uint256 public totalBurned;
    uint256 public totalDevFees;

    // Dividend tracking (points-per-share)
    uint256 public pointsPerKey;
    uint256 internal constant MAGNITUDE = 2**128;

    struct Player {
        uint256 keys;
        int256 pointsCorrection;
        uint256 withdrawnDividends;
    }

    mapping(uint256 => mapping(address => Player)) public players; // round => player
    mapping(uint256 => RoundResult) public roundResults;
    mapping(uint256 => uint256) public roundPointsPerKey; // snapshot of pointsPerKey when round ends

    struct RoundResult {
        address winner;
        uint256 potSize;
        uint256 winnerPayout;
        uint256 burned;
        uint256 endTime;
    }
    
    struct RoundInfo {
        uint256 currentRound;
        uint256 pot;
        uint256 roundEnd;
        address lastBuyer;
        uint256 totalKeys;
        uint256 currentKeyPrice;
        bool isActive;
        uint256 totalBurned;
    }

    // ============ Events ============
    event KeysPurchased(uint256 indexed round, address indexed buyer, uint256 keys, uint256 cost, uint256 burned);
    event RoundEnded(uint256 indexed round, address indexed winner, uint256 payout, uint256 burned, uint256 devFee);
    event DividendsClaimed(uint256 indexed round, address indexed player, uint256 amount);
    event RoundStarted(uint256 indexed round, uint256 endTime);
    event DevFeePaid(uint256 indexed round, uint256 amount);
    event TokensRecovered(address indexed token, uint256 amount);

    // ============ Errors ============
    error InvalidTimerDuration();
    error RoundNotOver();
    error RoundAlreadyEnded();
    error NoKeysBought();
    error NoDividendsOwed();
    error MaxKeysExceeded();
    error ZeroAddress();
    error OverflowRisk();

    // ============ Constructor ============
    constructor(address _clawd, uint256 _timerDuration, address _dev) Ownable(msg.sender) {
        if (_clawd == address(0) || _dev == address(0)) revert ZeroAddress();
        if (_timerDuration < MIN_TIMER_DURATION || _timerDuration > MAX_TIMER_DURATION) revert InvalidTimerDuration();
        
        clawd = IERC20(_clawd);
        timerDuration = _timerDuration;
        dev = _dev;
        currentRound = 1;
        roundStart = block.timestamp;
        roundEnd = block.timestamp + _timerDuration;
        emit RoundStarted(1, roundEnd);
    }

    // ============ Core ============

    /**
     * @notice Buy keys with $CLAWD. Requires prior approval.
     * @param numKeys Number of keys to buy (1 - MAX_KEYS_PER_BUY)
     */
    function buyKeys(uint256 numKeys) external nonReentrant whenNotPaused {
        if (numKeys == 0) revert NoKeysBought();
        if (numKeys > MAX_KEYS_PER_BUY) revert MaxKeysExceeded();
        if (block.timestamp >= roundEnd) revert RoundAlreadyEnded();
        
        // Check for overflow risk
        if (totalKeys + numKeys > type(uint256).max / PRICE_INCREMENT) revert OverflowRisk();

        uint256 cost = getCostForKeys(numKeys);
        if (cost == 0) revert NoKeysBought();

        // Transfer CLAWD from buyer
        clawd.safeTransferFrom(msg.sender, address(this), cost);

        // Burn 10% immediately
        uint256 burnAmount = (cost * BURN_ON_BUY_BPS) / BPS;
        uint256 toPot = cost - burnAmount;

        clawd.safeTransfer(DEAD, burnAmount);
        totalBurned += burnAmount;

        // Add to pot
        pot += toPot;

        // Update player keys
        Player storage p = players[currentRound][msg.sender];
        p.keys += numKeys;
        unchecked { p.pointsCorrection -= int256(pointsPerKey * numKeys); }
        totalKeys += numKeys;

        // Update last buyer and timer
        lastBuyer = msg.sender;

        // Anti-snipe: if within last 2 min, only extend by 2 min
        uint256 timeLeft = roundEnd - block.timestamp;
        if (timeLeft < ANTI_SNIPE_THRESHOLD) {
            roundEnd = block.timestamp + ANTI_SNIPE_EXTENSION;
        } else {
            roundEnd = block.timestamp + timerDuration;
        }

        emit KeysPurchased(currentRound, msg.sender, numKeys, cost, burnAmount);
    }

    /**
     * @notice End the round and distribute the pot. Anyone can call.
     */
    function endRound() external nonReentrant whenNotPaused {
        if (block.timestamp < roundEnd) revert RoundNotOver();
        if (lastBuyer == address(0)) revert NoKeysBought();

        uint256 potSize = pot;
        pot = 0;

        // Split pot
        uint256 winnerPayout = (potSize * WINNER_BPS) / BPS;
        uint256 burnPayout = (potSize * BURN_ON_END_BPS) / BPS;
        uint256 dividendPayout = (potSize * DIVIDENDS_BPS) / BPS;
        uint256 devPayout = potSize - winnerPayout - burnPayout - dividendPayout;

        // Pay winner
        clawd.safeTransfer(lastBuyer, winnerPayout);

        // Burn
        clawd.safeTransfer(DEAD, burnPayout);
        totalBurned += burnPayout;

        // Distribute dividends via points-per-key
        if (totalKeys > 0) {
            pointsPerKey += (dividendPayout * MAGNITUDE) / totalKeys;
        }

        // Dev fee
        clawd.safeTransfer(dev, devPayout);
        totalDevFees += devPayout;
        emit DevFeePaid(currentRound, devPayout);

        // Snapshot pointsPerKey for this round so dividends can be claimed later
        roundPointsPerKey[currentRound] = pointsPerKey;

        // Record result
        roundResults[currentRound] = RoundResult({
            winner: lastBuyer,
            potSize: potSize,
            winnerPayout: winnerPayout,
            burned: burnPayout,
            endTime: block.timestamp
        });

        emit RoundEnded(currentRound, lastBuyer, winnerPayout, burnPayout, devPayout);

        // Start new round
        unchecked { currentRound++; }
        roundStart = block.timestamp;
        roundEnd = block.timestamp + timerDuration;
        totalKeys = 0;
        lastBuyer = address(0);
        pointsPerKey = 0;

        emit RoundStarted(currentRound, roundEnd);
    }

    /**
     * @notice Claim accumulated dividends for a specific round.
     */
    function claimDividends(uint256 round) external nonReentrant {
        uint256 owed = _dividendsOf(round, msg.sender);
        if (owed == 0) revert NoDividendsOwed();

        Player storage p = players[round][msg.sender];
        p.withdrawnDividends += owed;
        clawd.safeTransfer(msg.sender, owed);

        emit DividendsClaimed(round, msg.sender, owed);
    }
    
    /**
     * @notice Emergency pause - only owner
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpause - only owner
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @notice Recover stuck tokens (non-CLAWD) - only owner
     * @param token The token to recover
     */
    function recoverStuckTokens(address token) external onlyOwner {
        if (token == address(clawd)) revert("Cannot recover CLAWD");
        IERC20 stuckToken = IERC20(token);
        uint256 balance = stuckToken.balanceOf(address(this));
        stuckToken.safeTransfer(owner(), balance);
        emit TokensRecovered(token, balance);
    }

    // ============ Views ============

    /**
     * @notice Get all round info in one call - frontend optimization
     */
    function getRoundInfo() external view returns (RoundInfo memory) {
        return RoundInfo({
            currentRound: currentRound,
            pot: pot,
            roundEnd: roundEnd,
            lastBuyer: lastBuyer,
            totalKeys: totalKeys,
            currentKeyPrice: BASE_PRICE + (totalKeys * PRICE_INCREMENT),
            isActive: block.timestamp < roundEnd,
            totalBurned: totalBurned
        });
    }
    
    /**
     * @notice Get player info for a round - frontend optimization
     */
    function getPlayer(uint256 round, address player) external view returns (uint256 keys, uint256 dividends, uint256 withdrawn) {
        Player storage p = players[round][player];
        keys = p.keys;
        dividends = _dividendsOf(round, player);
        withdrawn = p.withdrawnDividends;
    }

    function getCostForKeys(uint256 numKeys) public view returns (uint256) {
        if (numKeys == 0) return 0;
        // Sum of arithmetic sequence: sum = n * (2*a + (n-1)*d) / 2
        uint256 startPrice = BASE_PRICE + (totalKeys * PRICE_INCREMENT);
        uint256 endPrice = startPrice + ((numKeys - 1) * PRICE_INCREMENT);
        
        // Check for overflow
        if (endPrice < startPrice) revert OverflowRisk();
        
        return (numKeys * (startPrice + endPrice)) / 2;
    }
    
    /**
     * @notice Calculate cost alias for frontend compatibility
     */
    function calculateCost(uint256 numKeys) external view returns (uint256) {
        return getCostForKeys(numKeys);
    }

    function currentKeyPrice() external view returns (uint256) {
        return BASE_PRICE + (totalKeys * PRICE_INCREMENT);
    }

    function dividendsOf(uint256 round, address player) external view returns (uint256) {
        return _dividendsOf(round, player);
    }

    function _dividendsOf(uint256 round, address player) internal view returns (uint256) {
        Player storage p = players[round][player];
        uint256 ppk = round < currentRound ? roundPointsPerKey[round] : pointsPerKey;
        int256 accumulated = int256(ppk * p.keys) + p.pointsCorrection;
        if (accumulated < 0) return 0;
        uint256 total = uint256(accumulated) / MAGNITUDE;
        return total - p.withdrawnDividends;
    }

    function getPlayerKeys(uint256 round, address player) external view returns (uint256) {
        return players[round][player].keys;
    }

    function getRoundResult(uint256 round) external view returns (RoundResult memory) {
        return roundResults[round];
    }
}
