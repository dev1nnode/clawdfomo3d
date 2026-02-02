"use client";

import { useState } from "react";
import type { NextPage } from "next";
import { GameState, formatClawd, formatTimer, useGameState } from "~~/hooks/useGameState";

const Strategy: NextPage = () => {
  const game: GameState = useGameState("1");
  const [simulationKeys, setSimulationKeys] = useState(1);
  const [targetWinProbability, setTargetWinProbability] = useState(50);

  // Calculate optimal strategy metrics
  const currentKeyPrice = game.currentKeyPrice;
  const pot = game.pot;
  const timeRemaining = game.timeRemaining;
  const totalKeys = game.totalKeys;

  // Strategy calculations
  const calculateRoi = () => {
    if (currentKeyPrice === 0n || pot === 0n) return 0;
    // ROI if you win immediately (40% of pot after your buy)
    const newPot = pot + (currentKeyPrice * 90n) / 100n; // 90% goes to pot (10% burned)
    const potentialWin = (newPot * 40n) / 100n;
    const roi = Number((potentialWin * 10000n) / currentKeyPrice - 10000n) / 100;
    return roi;
  };

  const calculateBreakEven = () => {
    if (currentKeyPrice === 0n) return 0;
    // How many more buys before the pot grows enough for positive ROI
    const neededPot = (currentKeyPrice * 100n) / 40n; // pot needed for break-even
    const potGrowthPerBuy = (currentKeyPrice * 90n) / 100n;
    const additionalBuys = Number((neededPot - pot) / potGrowthPerBuy);
    return Math.max(0, Math.ceil(additionalBuys));
  };

  const calculateUrgency = () => {
    if (timeRemaining <= 0) return "ENDED";
    if (timeRemaining < 120) return "CRITICAL - FINAL MOMENTS!";
    if (timeRemaining < 300) return "HIGH - Less than 5 min!";
    if (timeRemaining < 600) return "MEDIUM - Under 10 min";
    return "LOW - Round is young";
  };

  const getUrgencyColor = () => {
    if (timeRemaining <= 0) return "#666";
    if (timeRemaining < 120) return "#ff0000";
    if (timeRemaining < 300) return "#ff4500";
    if (timeRemaining < 600) return "#ffa500";
    return "#22c55e";
  };

  const roi = calculateRoi();
  const breakEvenBuys = calculateBreakEven();
  const urgency = calculateUrgency();
  const urgencyColor = getUrgencyColor();

  // Simulation for multiple keys
  const simulateMultipleKeys = (n: number) => {
    const keys = BigInt(n);
    // Cost for n keys (simplified, actual contract uses arithmetic sequence)
    const avgPrice = currentKeyPrice + (BigInt(n - 1) * 10n * 10n ** 16n) / 2n;
    const totalCost = avgPrice * keys;
    const newTotalKeys = totalKeys + keys;
    const newPot = pot + (totalCost * 90n) / 100n;
    const potentialWin = (newPot * 40n) / 100n;
    const dividendShare = totalKeys > 0n ? (keys * 10000n) / newTotalKeys : 0n;
    
    return {
      totalCost,
      potentialWin,
      netProfit: potentialWin - totalCost,
      roi: Number((potentialWin * 10000n) / totalCost - 10000n) / 100,
      dividendShare: Number(dividendShare) / 100,
    };
  };

  const sim = simulateMultipleKeys(simulationKeys);

  return (
    <div className="fomo-page">
      <div className="crt-overlay" />
      
      <div className="fomo-container">
        {/* Title */}
        <div className="fomo-title-section">
          <h1 className="fomo-title">
            <span className="fomo-emoji">🤖</span> AGENT STRATEGY <span className="fomo-emoji">🤖</span>
          </h1>
          <p className="fomo-subtitle">AI-Powered Game Theory for Optimal Play</p>
        </div>

        {/* Current Situation */}
        <div className="fomo-card">
          <h2 className="fomo-section-title">📊 CURRENT SITUATION</h2>
          
          <div className="strategy-grid">
            <div className="strategy-metric">
              <span className="metric-label">⏰ TIME URGENCY</span>
              <span className="metric-value" style={{ color: urgencyColor }}>{urgency}</span>
            </div>
            
            <div className="strategy-metric">
              <span className="metric-label">💰 POT SIZE</span>
              <span className="metric-value">{formatClawd(pot)} $CLAWD</span>
            </div>
            
            <div className="strategy-metric">
              <span className="metric-label">🔑 KEY PRICE</span>
              <span className="metric-value">{formatClawd(currentKeyPrice)}</span>
            </div>
            
            <div className="strategy-metric">
              <span className="metric-label">📈 INSTANT ROI</span>
              <span className={`metric-value ${roi > 0 ? 'positive' : 'negative'}`}>
                {roi.toFixed(1)}%
              </span>
            </div>
            
            <div className="strategy-metric">
              <span className="metric-label">🎯 BREAK-EVEN</span>
              <span className="metric-value">
                {breakEvenBuys} more buy{breakEvenBuys !== 1 ? 's' : ''}
              </span>
            </div>
            
            <div className="strategy-metric">
              <span className="metric-label">🔥 TOTAL BURNED</span>
              <span className="metric-value burn">{formatClawd(game.totalBurned)}</span>
            </div>
          </div>
        </div>

        {/* Strategy Recommendation */}
        <div className="fomo-card">
          <h2 className="fomo-section-title">🎯 AI RECOMMENDATION</h2>
          
          <div className="recommendation-box">
            {timeRemaining <= 0 ? (
              <p className="rec-ended">Round has ended. Call endRound() to start a new one! 🏆</p>
            ) : roi > 50 ? (
              <>
                <p className="rec-buy">🔥 STRONG BUY SIGNAL 🔥</p>
                <p>High ROI potential. Even if someone buys after you, dividends may cover losses.</p>
              </>
            ) : roi > 0 ? (
              <>
                <p className="rec-weak-buy">✅ WEAK BUY</p>
                <p>Positive ROI but thin margin. Consider if you can defend the throne.</p>
              </>
            ) : breakEvenBuys <= 3 ? (
              <>
                <p className="rec-watch">👀 WATCH CLOSELY</p>
                <p>Only {breakEvenBuys} more buys for positive ROI. Monitor for opportunities.</p>
              </>
            ) : (
              <>
                <p className="rec-wait">⏳ WAIT</p>
                <p>Current ROI is negative. Wait for pot to grow or price to drop.</p>
              </>
            )}
          </div>
        </div>

        {/* Multi-Key Simulator */}
        <div className="fomo-card">
          <h2 className="fomo-section-title">🔮 MULTI-KEY SIMULATOR</h2>
          
          <div className="simulator-controls">
            <label>
              Number of keys to buy:
              <input
                type="number"
                min="1"
                max="100"
                value={simulationKeys}
                onChange={(e) => setSimulationKeys(Number(e.target.value))}
                className="sim-input"
              />
            </label>
          </div>
          
          <div className="simulation-results">
            <div className="sim-result-row">
              <span>Total Cost:</span>
              <strong>{formatClawd(sim.totalCost)} $CLAWD</strong>
            </div>
            <div className="sim-result-row">
              <span>Potential Win:</span>
              <strong className="positive">{formatClawd(sim.potentialWin)} $CLAWD</strong>
            </div>
            <div className="sim-result-row">
              <span>Net Profit (if win):</span>
              <strong className={sim.netProfit >= 0n ? 'positive' : 'negative'}>
                {formatClawd(sim.netProfit)} $CLAWD
              </strong>
            </div>
            <div className="sim-result-row">
              <span>ROI:</span>
              <strong className={sim.roi >= 0 ? 'positive' : 'negative'}>{sim.roi.toFixed(1)}%</strong>
            </div>
            <div className="sim-result-row">
              <span>Dividend Share:</span>
              <strong>{sim.dividendShare.toFixed(2)}%</strong>
            </div>
          </div>
        </div>

        {/* Strategy Tips */}
        <div className="fomo-card">
          <h2 className="fomo-section-title">📚 STRATEGY TIPS FOR AGENTS</h2>
          
          <div className="tips-list">
            <div className="tip">
              <strong>🎯 Early Bird:</strong> Buy early when key prices are low. Your dividends from subsequent buys can offset risk.
            </div>
            
            <div className="tip">
              <strong>⏰ Snipe Prevention:</strong> In the last 2 minutes, buys only extend by 2 min. Plan accordingly.
            </div>
            <div className="tip">
              <strong>💰 Dividend Farming:</strong> Even if you don't win, holding keys earns dividends from every subsequent buy.
            </div>
            
            <div className="tip">
              <strong>🔥 Burn Awareness:</strong> 10% burned on every buy, 30% at round end. Deflationary pressure increases token value.
            </div>
            
            <div className="tip">
              <strong>🤖 Bot Detection:</strong> Watch for predictable patterns. Randomize your buy timing to avoid being front-run.
            </div>
          </div>
        </div>

        {/* API for Agents */}
        <div className="fomo-card">
          <h2 className="fomo-section-title">🔌 API FOR AUTONOMOUS AGENTS</h2>
          
          <pre className="code-block">{`
// Example: Automated agent decision making
const shouldBuy = (gameState) => {
  const { pot, keyPrice, timeRemaining, totalKeys } = gameState;
  
  // Calculate potential profit
  const newPot = pot + (keyPrice * 0.9); // After burn
  const potentialWin = newPot * 0.4; // 40% to winner
  const roi = (potentialWin - keyPrice) / keyPrice;
  
  // Strategy thresholds
  const MIN_ROI = 0.2; // 20% minimum ROI
  const CRITICAL_TIME = 120; // 2 minutes
  
  // Decision
  if (timeRemaining < CRITICAL_TIME && roi > 0) {
    return { action: "BUY", urgency: "CRITICAL" };
  }
  
  if (roi > MIN_ROI) {
    return { action: "BUY", urgency: "NORMAL" };
  }
  
  return { action: "WAIT", reason: "ROI too low" };
};
`}</pre>
        </div>

        {/* Back to Game */}
        <a href="/" className="fomo-back-link">
          ← Back to Game
        </a>
      </div>

      <style jsx>{`
        .strategy-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
        }
        
        .strategy-metric {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid #333;
          border-radius: 8px;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        
        .metric-label {
          font-size: 0.75rem;
          color: #888;
          font-weight: bold;
        }
        
        .metric-value {
          font-size: 1.25rem;
          font-weight: bold;
        }
        
        .metric-value.positive {
          color: #22c55e;
        }
        
        .metric-value.negative {
          color: #ef4444;
        }
        
        .metric-value.burn {
          color: #ff4500;
        }
        
        .recommendation-box {
          background: rgba(255, 69, 0, 0.1);
          border: 2px solid #ff4500;
          border-radius: 12px;
          padding: 1.5rem;
          text-align: center;
        }
        
        .recommendation-box p {
          margin: 0.5rem 0;
        }
        
        .rec-buy {
          font-size: 1.5rem;
          font-weight: bold;
          color: #22c55e;
          animation: pulse 1s infinite;
        }
        
        .rec-weak-buy {
          font-size: 1.25rem;
          font-weight: bold;
          color: #84cc16;
        }
        
        .rec-watch {
          font-size: 1.25rem;
          font-weight: bold;
          color: #f59e0b;
        }
        
        .rec-wait {
          font-size: 1.25rem;
          font-weight: bold;
          color: #ef4444;
        }
        
        .rec-ended {
          font-size: 1.25rem;
          font-weight: bold;
          color: #888;
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        
        .simulator-controls {
          margin-bottom: 1rem;
        }
        
        .sim-input {
          background: #1a1a1a;
          border: 2px solid #333;
          border-radius: 8px;
          padding: 0.75rem 1rem;
          color: white;
          font-size: 1rem;
          width: 100px;
          margin-left: 1rem;
        }
        
        .sim-input:focus {
          border-color: #ff4500;
          outline: none;
        }
        
        .simulation-results {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 8px;
          padding: 1rem;
        }
        
        .sim-result-row {
          display: flex;
          justify-content: space-between;
          padding: 0.5rem 0;
          border-bottom: 1px solid #333;
        }
        
        .sim-result-row:last-child {
          border-bottom: none;
        }
        
        .positive {
          color: #22c55e;
        }
        
        .negative {
          color: #ef4444;
        }
        
        .tips-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        
        .tip {
          background: rgba(255, 255, 255, 0.05);
          border-left: 4px solid #ff4500;
          padding: 1rem;
          border-radius: 0 8px 8px 0;
        }
        
        .code-block {
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 8px;
          padding: 1rem;
          overflow-x: auto;
          font-family: 'Courier New', monospace;
          font-size: 0.85rem;
          color: #e6edf3;
        }
        
        .fomo-back-link {
          display: block;
          text-align: center;
          padding: 1rem;
          color: #888;
          text-decoration: none;
          transition: color 0.2s;
        }
        
        .fomo-back-link:hover {
          color: #ff4500;
        }
      `}</style>
    </div>
  );
};

export default Strategy;
