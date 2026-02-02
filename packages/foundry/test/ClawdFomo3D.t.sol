// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/ClawdFomo3D.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Mock CLAWD token for testing
contract MockCLAWD is ERC20 {
    constructor() ERC20("CLAWD", "CLAWD") {
        _mint(msg.sender, 1_000_000_000 * 10**18); // 1B tokens
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract ClawdFomo3DTest is Test {
    ClawdFomo3D public game;
    MockCLAWD public clawd;
    
    address public owner = address(1);
    address public dev = address(2);
    address public player1 = address(3);
    address public player2 = address(4);
    address public player3 = address(5);
    
    uint256 public constant TIMER_DURATION = 1 hours;
    uint256 public constant INITIAL_MINT = 1_000_000 * 10**18; // 1M tokens per player
    
    function setUp() public {
        vm.startPrank(owner);
        clawd = new MockCLAWD();
        game = new ClawdFomo3D(address(clawd), TIMER_DURATION, dev);
        vm.stopPrank();
        
        // Fund players
        clawd.mint(player1, INITIAL_MINT);
        clawd.mint(player2, INITIAL_MINT);
        clawd.mint(player3, INITIAL_MINT);
    }
    
    // ============ Constructor Tests ============
    
    function test_Constructor() public {
        assertEq(address(game.clawd()), address(clawd));
        assertEq(game.dev(), dev);
        assertEq(game.timerDuration(), TIMER_DURATION);
        assertEq(game.currentRound(), 1);
        assertEq(game.totalBurned(), 0);
        assertEq(game.totalDevFees(), 0);
    }
    
    function test_Constructor_RevertsZeroAddressToken() public {
        vm.expectRevert(ClawdFomo3D.ZeroAddress.selector);
        new ClawdFomo3D(address(0), TIMER_DURATION, dev);
    }
    
    function test_Constructor_RevertsZeroAddressDev() public {
        vm.expectRevert(ClawdFomo3D.ZeroAddress.selector);
        new ClawdFomo3D(address(clawd), TIMER_DURATION, address(0));
    }
    
    function test_Constructor_RevertsInvalidTimerTooShort() public {
        vm.expectRevert(ClawdFomo3D.InvalidTimerDuration.selector);
        new ClawdFomo3D(address(clawd), 4 minutes, dev);
    }
    
    function test_Constructor_RevertsInvalidTimerTooLong() public {
        vm.expectRevert(ClawdFomo3D.InvalidTimerDuration.selector);
        new ClawdFomo3D(address(clawd), 8 days, dev);
    }
    
    // ============ Buy Keys Tests ============
    
    function test_BuyKeys_Single() public {
        uint256 numKeys = 1;
        uint256 cost = game.getCostForKeys(numKeys);
        
        vm.startPrank(player1);
        clawd.approve(address(game), cost);
        game.buyKeys(numKeys);
        vm.stopPrank();
        
        assertEq(game.totalKeys(), numKeys);
        assertEq(game.getPlayerKeys(1, player1), numKeys);
        assertEq(game.lastBuyer(), player1);
        assertGt(game.totalBurned(), 0);
    }
    
    function test_BuyKeys_Multiple() public {
        uint256 numKeys = 10;
        uint256 cost = game.getCostForKeys(numKeys);
        uint256 burnBefore = game.totalBurned();
        
        vm.startPrank(player1);
        clawd.approve(address(game), cost);
        game.buyKeys(numKeys);
        vm.stopPrank();
        
        assertEq(game.totalKeys(), numKeys);
        assertEq(game.getPlayerKeys(1, player1), numKeys);
        
        // Check 10% was burned
        uint256 expectedBurn = (cost * 1000) / 10000;
        assertEq(game.totalBurned() - burnBefore, expectedBurn);
    }
    
    function test_BuyKeys_ResetsTimer() public {
        uint256 roundEndBefore = game.roundEnd();
        
        vm.startPrank(player1);
        clawd.approve(address(game), game.getCostForKeys(1));
        game.buyKeys(1);
        vm.stopPrank();
        
        assertEq(game.roundEnd(), roundEndBefore); // Timer resets to full duration
    }
    
    function test_BuyKeys_AntiSnipe() public {
        // Buy first key
        vm.startPrank(player1);
        clawd.approve(address(game), game.getCostForKeys(1));
        game.buyKeys(1);
        vm.stopPrank();
        
        // Fast forward to almost end (within anti-snipe threshold)
        vm.warp(game.roundEnd() - 1 minutes);
        
        uint256 roundEndBefore = game.roundEnd();
        
        // Buy during anti-snipe period
        vm.startPrank(player2);
        clawd.approve(address(game), game.getCostForKeys(1));
        game.buyKeys(1);
        vm.stopPrank();
        
        // Timer should only extend by 2 minutes, not full duration
        assertEq(game.roundEnd(), block.timestamp + 2 minutes);
    }
    
    function test_BuyKeys_RevertsZeroKeys() public {
        vm.startPrank(player1);
        vm.expectRevert(ClawdFomo3D.NoKeysBought.selector);
        game.buyKeys(0);
        vm.stopPrank();
    }
    
    function test_BuyKeys_RevertsTooManyKeys() public {
        vm.startPrank(player1);
        vm.expectRevert(ClawdFomo3D.MaxKeysExceeded.selector);
        game.buyKeys(1001);
        vm.stopPrank();
    }
    
    function test_BuyKeys_RevertsRoundEnded() public {
        // Fast forward past round end
        vm.warp(game.roundEnd() + 1);
        
        vm.startPrank(player1);
        vm.expectRevert(ClawdFomo3D.RoundAlreadyEnded.selector);
        game.buyKeys(1);
        vm.stopPrank();
    }
    
    function test_BuyKeys_RevertsWhenPaused() public {
        vm.prank(owner);
        game.pause();
        
        vm.startPrank(player1);
        clawd.approve(address(game), game.getCostForKeys(1));
        vm.expectRevert(Pausable.EnforcedPause.selector);
        game.buyKeys(1);
        vm.stopPrank();
    }
    
    // ============ End Round Tests ============
    
    function test_EndRound() public {
        // Player 1 buys key
        vm.startPrank(player1);
        clawd.approve(address(game), game.getCostForKeys(1));
        game.buyKeys(1);
        vm.stopPrank();
        
        uint256 potBefore = game.pot();
        
        // Fast forward to end
        vm.warp(game.roundEnd() + 1);
        
        // End round
        vm.prank(player2); // Anyone can call
        game.endRound();
        
        // Check new round started
        assertEq(game.currentRound(), 2);
        assertEq(game.pot(), 0);
        assertEq(game.totalKeys(), 0);
        assertEq(game.lastBuyer(), address(0));
    }
    
    function test_EndRound_Distribution() public {
        // Player 1 buys 10 keys
        vm.startPrank(player1);
        clawd.approve(address(game), game.getCostForKeys(10));
        game.buyKeys(10);
        vm.stopPrank();
        
        uint256 pot = game.pot();
        uint256 devBalanceBefore = clawd.balanceOf(dev);
        
        // Fast forward to end
        vm.warp(game.roundEnd() + 1);
        
        // End round
        game.endRound();
        
        // Check dev fee was paid (should be ~5% after rounding)
        uint256 devBalanceAfter = clawd.balanceOf(dev);
        uint256 devFee = devBalanceAfter - devBalanceBefore;
        assertGt(devFee, 0);
        
        // Check totalDevFees tracked
        assertEq(game.totalDevFees(), devFee);
    }
    
    function test_EndRound_RevertsNotOver() public {
        vm.startPrank(player1);
        clawd.approve(address(game), game.getCostForKeys(1));
        game.buyKeys(1);
        
        vm.expectRevert(ClawdFomo3D.RoundNotOver.selector);
        game.endRound();
        vm.stopPrank();
    }
    
    function test_EndRound_RevertsNoOnePlayed() public {
        // Fast forward without any buys
        vm.warp(game.roundEnd() + 1);
        
        vm.expectRevert(ClawdFomo3D.NoKeysBought.selector);
        game.endRound();
    }
    
    // ============ Dividends Tests ============
    
    function test_Dividends_Accumulate() public {
        // Player 1 buys early
        vm.startPrank(player1);
        clawd.approve(address(game), game.getCostForKeys(5));
        game.buyKeys(5);
        vm.stopPrank();
        
        // Player 2 buys later (creates dividends for player 1)
        vm.startPrank(player2);
        clawd.approve(address(game), game.getCostForKeys(10));
        game.buyKeys(10);
        vm.stopPrank();
        
        // Player 1 should have dividends
        uint256 dividends = game.dividendsOf(1, player1);
        assertGt(dividends, 0);
    }
    
    function test_ClaimDividends() public {
        // Setup: Player 1 buys, Player 2 buys, round ends
        vm.startPrank(player1);
        clawd.approve(address(game), game.getCostForKeys(5));
        game.buyKeys(5);
        vm.stopPrank();
        
        vm.startPrank(player2);
        clawd.approve(address(game), game.getCostForKeys(10));
        game.buyKeys(10);
        vm.stopPrank();
        
        vm.warp(game.roundEnd() + 1);
        game.endRound();
        
        uint256 dividends = game.dividendsOf(1, player1);
        assertGt(dividends, 0);
        
        uint256 balanceBefore = clawd.balanceOf(player1);
        
        vm.prank(player1);
        game.claimDividends(1);
        
        uint256 balanceAfter = clawd.balanceOf(player1);
        assertEq(balanceAfter - balanceBefore, dividends);
    }
    
    function test_ClaimDividends_RevertsNoDividends() public {
        vm.expectRevert(ClawdFomo3D.NoDividendsOwed.selector);
        game.claimDividends(1);
    }
    
    // ============ Pricing Tests ============
    
    function test_Pricing_BondingCurve() public {
        uint256 price1 = game.getCostForKeys(1);
        
        // Buy one key
        vm.startPrank(player1);
        clawd.approve(address(game), price1);
        game.buyKeys(1);
        vm.stopPrank();
        
        // Price should increase
        uint256 price2 = game.getCostForKeys(1);
        assertGt(price2, price1);
        
        // Check currentKeyPrice matches
        assertEq(game.currentKeyPrice(), price2);
    }
    
    function test_Pricing_ArithmeticSequence() public {
        // Price for 10 keys should follow arithmetic sequence
        uint256 cost10 = game.getCostForKeys(10);
        
        // Manual calculation: sum = n/2 * (2a + (n-1)d)
        // where a = BASE_PRICE, d = PRICE_INCREMENT, n = 10
        uint256 expected = (10 * (2 * game.BASE_PRICE() + 9 * game.PRICE_INCREMENT())) / 2;
        assertEq(cost10, expected);
    }
    
    // ============ Admin Tests ============
    
    function test_Pause() public {
        vm.prank(owner);
        game.pause();
        assertTrue(game.paused());
    }
    
    function test_Unpause() public {
        vm.startPrank(owner);
        game.pause();
        game.unpause();
        vm.stopPrank();
        assertFalse(game.paused());
    }
    
    function test_Pause_RevertsNonOwner() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, player1));
        vm.prank(player1);
        game.pause();
    }
    
    function test_RecoverStuckTokens() public {
        // Deploy a random token and send to contract
        MockCLAWD stuckToken = new MockCLAWD();
        stuckToken.mint(address(game), 1000 * 10**18);
        
        uint256 ownerBalanceBefore = stuckToken.balanceOf(owner);
        
        vm.prank(owner);
        game.recoverStuckTokens(address(stuckToken));
        
        uint256 ownerBalanceAfter = stuckToken.balanceOf(owner);
        assertEq(ownerBalanceAfter - ownerBalanceBefore, 1000 * 10**18);
    }
    
    function test_RecoverStuckTokens_RevertsCLAWD() public {
        vm.prank(owner);
        vm.expectRevert("Cannot recover CLAWD");
        game.recoverStuckTokens(address(clawd));
    }
    
    function test_RecoverStuckTokens_RevertsNonOwner() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, player1));
        vm.prank(player1);
        game.recoverStuckTokens(address(clawd));
    }
    
    // ============ View Function Tests ============
    
    function test_GetRoundInfo() public {
        ClawdFomo3D.RoundInfo memory info = game.getRoundInfo();
        
        assertEq(info.currentRound, 1);
        assertEq(info.pot, 0);
        assertEq(info.totalKeys, 0);
        assertEq(info.isActive, true);
        assertEq(info.totalBurned, 0);
    }
    
    function test_GetPlayer() public {
        vm.startPrank(player1);
        clawd.approve(address(game), game.getCostForKeys(5));
        game.buyKeys(5);
        vm.stopPrank();
        
        (uint256 keys, uint256 dividends, uint256 withdrawn) = game.getPlayer(1, player1);
        
        assertEq(keys, 5);
        assertEq(dividends, 0); // No dividends yet (round not ended)
        assertEq(withdrawn, 0);
    }
    
    // ============ Edge Cases ============
    
    function test_MultipleRounds() public {
        for (uint256 round = 1; round <= 3; round++) {
            // Buy keys
            vm.startPrank(player1);
            clawd.approve(address(game), game.getCostForKeys(3));
            game.buyKeys(3);
            vm.stopPrank();
            
            // End round
            vm.warp(game.roundEnd() + 1);
            game.endRound();
            
            assertEq(game.currentRound(), round + 1);
        }
    }
    
    function test_TimeRemaining() public {
        assertGt(game.timeRemaining(), 0);
        
        vm.warp(game.roundEnd() + 1);
        assertEq(game.timeRemaining(), 0);
    }
    
    // ============ Fuzz Tests ============
    
    function testFuzz_BuyKeys(uint256 numKeys) public {
        vm.assume(numKeys > 0 && numKeys <= 1000);
        
        uint256 cost = game.getCostForKeys(numKeys);
        vm.assume(cost <= INITIAL_MINT); // Ensure player has enough
        
        vm.startPrank(player1);
        clawd.approve(address(game), cost);
        game.buyKeys(numKeys);
        vm.stopPrank();
        
        assertEq(game.totalKeys(), numKeys);
    }
    
    function testFuzz_Pricing(uint256 n) public {
        vm.assume(n > 0 && n <= 1000);
        
        uint256 cost = game.getCostForKeys(n);
        
        // Cost should always be positive and increase with n
        assertGt(cost, 0);
        
        if (n > 1) {
            assertGt(cost, game.getCostForKeys(n - 1) + game.getCostForKeys(1));
        }
    }
}
