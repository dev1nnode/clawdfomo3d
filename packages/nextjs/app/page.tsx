"use client";

import { useState } from "react";
import type { NextPage } from "next";
import { erc20Abi } from "viem";
import { useAccount } from "wagmi";
import { useWriteContract } from "wagmi";
import { useDeployedContractInfo, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { GameState, formatClawd, formatTimer, shortAddr, useGameState } from "~~/hooks/useGameState";

const CLAWD_TOKEN = "0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07" as const;

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const [numKeys, setNumKeys] = useState<string>("1");
  const [isApproving, setIsApproving] = useState(false);
  const [isBuying, setIsBuying] = useState(false);

  const { data: fomo3dContract } = useDeployedContractInfo("ClawdFomo3D");

  // ============ SINGLE polling hook — one multicall every 3s ============
  const game: GameState = useGameState(numKeys);

  // ============ Write Functions ============
  const { writeContractAsync: writeBuyKeys } = useScaffoldWriteContract({ contractName: "ClawdFomo3D" });
  const { writeContractAsync: writeEndRound } = useScaffoldWriteContract({ contractName: "ClawdFomo3D" });
  const { writeContractAsync: writeClaim } = useScaffoldWriteContract({ contractName: "ClawdFomo3D" });
  const { writeContractAsync: writeApprove } = useWriteContract();

  const isRoundOver = !game.isActive || game.timeRemaining <= 0;
  const fomo3dAddress = fomo3dContract?.address;

  return (
    <div className="fomo-page">
      {/* CRT Scanline Overlay */}
      <div className="crt-overlay" />

      <div className="fomo-container">
        {/* ============ TITLE ============ */}
        <div className="fomo-title-section">
          <h1 className="fomo-title">
            <span className="fomo-emoji">🔥</span> CLAWDFOMO3D <span className="fomo-emoji">🔥</span>
          </h1>
          <p className="fomo-subtitle">LAST BUYER WINS EVERYTHING.</p>
        </div>

        {/* ============ HOW TO PLAY ============ */}
        <div className="fomo-card fomo-howto">
          <div className="fomo-howto-steps">
            <div className="fomo-step">
              <span className="fomo-step-icon">🔑</span>
              <div>
                <strong>BUY A KEY</strong>
                <span className="fomo-step-desc">
                  {" "}
                  — Adds time to the clock. Makes YOU the King.
                  <br />
                  <span className="fomo-step-bonus">(Bonus: Earn dividends from every buy after yours!)</span>
                </span>
              </div>
            </div>
            <div className="fomo-step">
              <span className="fomo-step-icon">👑</span>
              <div>
                <strong>HOLD THE THRONE</strong>
                <span className="fomo-step-desc">
                  {" "}
                  — If the timer hits 00:00:00 while you are King…{" "}
                  <strong className="fomo-accent-green">YOU WIN THE POT.</strong> 💰
                </span>
              </div>
            </div>
            <div className="fomo-step">
              <span className="fomo-step-icon">🔥</span>
              <div>
                <strong>BURN IT ALL</strong>
                <span className="fomo-step-desc"> — Every buy burns $CLAWD. Number go up.</span>
              </div>
            </div>
          </div>
        </div>

        {/* ============ GAME STATE ============ */}
        <div className="fomo-card fomo-game-card">
          {/* Round Badge */}
          <div className="fomo-round-badge">ROUND {game.currentRound.toString()}</div>

          {/* Timer */}
          <div className={`fomo-timer ${isRoundOver ? "fomo-timer-ended" : ""}`}>
            {isRoundOver ? "💀 ENDED" : formatTimer(game.timeRemaining)}
          </div>

          {/* Pot — THE BIG NUMBER */}
          <div className="fomo-pot-section">
            <div className="fomo-pot-label">💰 THE POT</div>
            <div className="fomo-pot-value">{formatClawd(game.pot)} $CLAWD</div>
          </div>

          {/* Stats Grid */}
          <div className="fomo-stats-grid">
            <div className="fomo-stat-box">
              <div className="fomo-stat-label">KEY PRICE</div>
              <div className="fomo-stat-value">{formatClawd(game.currentKeyPrice)}</div>
            </div>
            <div className="fomo-stat-box">
              <div className="fomo-stat-label">KEYS SOLD</div>
              <div className="fomo-stat-value">{game.totalKeys.toString()}</div>
            </div>
            <div className="fomo-stat-box">
              <div className="fomo-stat-label">🔥 BURNED</div>
              <div className="fomo-stat-value fomo-burn-value">{formatClawd(game.totalBurned)}</div>
            </div>
            <div className="fomo-stat-box">
              <div className="fomo-stat-label">👑 KING</div>
              <div className="fomo-stat-value fomo-king-value">{shortAddr(game.lastBuyer)}</div>
            </div>
          </div>
        </div>

        {/* ============ PRIZE BANNER ============ */}
        {game.lastBuyer !== "0x0000000000000000000000000000000000000000" && !isRoundOver && (
          <div className="fomo-prize-banner">
            👑 {shortAddr(game.lastBuyer)} wins <strong>{formatClawd((game.pot * 50n) / 100n)} $CLAWD</strong> if nobody
            buys a key!
          </div>
        )}

        {/* ============ BUY / END ROUND ============ */}
        <div className="fomo-card fomo-action-card">
          {!isRoundOver ? (
            <>
              <div className="fomo-buy-row">
                <input
                  type="number"
                  min="1"
                  value={numKeys}
                  onChange={e => setNumKeys(e.target.value)}
                  className="fomo-key-input"
                  placeholder="# keys"
                />
                <button
                  className="fomo-buy-btn"
                  disabled={isBuying || !connectedAddress}
                  onClick={async () => {
                    if (!game.costForKeys || !connectedAddress) return;
                    setIsBuying(true);
                    try {
                      await writeBuyKeys({
                        functionName: "buyKeys",
                        args: [BigInt(numKeys || "1")],
                      });
                    } catch (e) {
                      console.error("Buy failed:", e);
                    }
                    setIsBuying(false);
                  }}
                >
                  {isBuying ? "⏳ BUYING..." : "👑 SNATCH THE CROWN"}
                </button>
              </div>
              <div className="fomo-cost-line">
                Cost: <strong>{formatClawd(game.costForKeys)} $CLAWD</strong>{" "}
                <span className="fomo-cost-note">(incl. 10% burn 🔥)</span>
              </div>
              {fomo3dAddress && (
                <button
                  className="fomo-approve-btn"
                  disabled={isApproving || !game.costForKeys || !connectedAddress}
                  onClick={async () => {
                    if (!game.costForKeys || !fomo3dAddress) return;
                    setIsApproving(true);
                    try {
                      const approveAmount = game.costForKeys * 100n;
                      await writeApprove({
                        address: CLAWD_TOKEN,
                        abi: erc20Abi,
                        functionName: "approve",
                        args: [fomo3dAddress, approveAmount],
                      });
                    } catch (e) {
                      console.error("Approve failed:", e);
                    }
                    setIsApproving(false);
                  }}
                >
                  {isApproving ? "⏳ Approving..." : "✅ Approve $CLAWD (do this first!)"}
                </button>
              )}
            </>
          ) : (
            <button
              className="fomo-end-btn"
              onClick={async () => {
                try {
                  await writeEndRound({ functionName: "endRound" });
                } catch (e) {
                  console.error("End round failed:", e);
                }
              }}
            >
              🏆 END ROUND & CROWN THE WINNER
            </button>
          )}
        </div>

        {/* ============ YOUR STATS ============ */}
        {connectedAddress && (
          <div className="fomo-card fomo-player-card">
            <h2 className="fomo-section-title">YOUR STATS</h2>
            <div className="fomo-player-grid">
              <div className="fomo-stat-box">
                <div className="fomo-stat-label">YOUR KEYS</div>
                <div className="fomo-stat-value fomo-accent-green">{game.playerKeys.toString()}</div>
              </div>
              <div className="fomo-stat-box">
                <div className="fomo-stat-label">DIVIDENDS</div>
                <div className="fomo-stat-value fomo-accent-orange">{formatClawd(game.playerDividends)}</div>
              </div>
            </div>
            {game.playerDividends > 0n && (
              <button
                className="fomo-claim-btn"
                onClick={async () => {
                  try {
                    await writeClaim({
                      functionName: "claimDividends",
                      args: [game.currentRound],
                    });
                  } catch (e) {
                    console.error("Claim failed:", e);
                  }
                }}
              >
                💰 Claim {formatClawd(game.playerDividends)} $CLAWD
              </button>
            )}
          </div>
        )}

        {/* ============ RULES ============ */}
        <div className="fomo-card fomo-rules-card">
          <h2 className="fomo-section-title">THE RULES</h2>
          <div className="fomo-rules-list">
            <div className="fomo-rule">
              <span className="fomo-rule-emoji">🔥</span> 10% of every buy is <strong>burned forever</strong>
            </div>
            <div className="fomo-rule">
              <span className="fomo-rule-emoji">👑</span> Winner takes <strong>50%</strong> of the pot
            </div>
            <div className="fomo-rule">
              <span className="fomo-rule-emoji">💰</span> Key holders split <strong>25%</strong> as dividends
            </div>
            <div className="fomo-rule">
              <span className="fomo-rule-emoji">🔥</span> Another <strong>20%</strong> burned at round end
            </div>
            <div className="fomo-rule">
              <span className="fomo-rule-emoji">⚡</span> Anti-snipe: Buys in last 2 min only add 2 min
            </div>
          </div>
        </div>

        {/* Loading State */}
        {game.isLoading && (
          <div className="fomo-loading">
            <span className="loading loading-spinner loading-lg"></span>
            <p>Connecting to Base...</p>
          </div>
        )}

        {/* Error State */}
        {game.error && <div className="fomo-error">⚠️ {game.error}</div>}
      </div>
    </div>
  );
};

export default Home;
