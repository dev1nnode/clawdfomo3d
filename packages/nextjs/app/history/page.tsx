"use client";

import { useEffect, useState } from "react";
import type { NextPage } from "next";
import { Abi, Address } from "viem";
import { usePublicClient } from "wagmi";
import { formatClawd, shortAddr } from "~~/hooks/useGameState";

const CONTRACT_ADDRESS = "0x572Bc6149a5A9b013b5e9c370aEf6Fec8388F53f" as const;

// Extended ABI with round history functions
const GAME_ABI = [
  {
    type: "function",
    name: "currentRound",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getRoundResult",
    inputs: [{ name: "round", type: "uint256" }],
    outputs: [
      { name: "winner", type: "address" },
      { name: "potSize", type: "uint256" },
      { name: "winnerPayout", type: "uint256" },
      { name: "burned", type: "uint256" },
      { name: "endTime", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalBurned",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

interface RoundResult {
  round: number;
  winner: string;
  potSize: bigint;
  winnerPayout: bigint;
  burned: bigint;
  endTime: bigint;
}

interface Stats {
  totalRounds: number;
  totalPot: bigint;
  totalBurned: bigint;
  biggestWin: bigint;
  averagePot: bigint;
}

const History: NextPage = () => {
  const publicClient = usePublicClient({ chainId: 8453 });
  const [rounds, setRounds] = useState<RoundResult[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(10);

  useEffect(() => {
    if (!publicClient) return;

    const fetchHistory = async () => {
      try {
        // Get current round to know how many to fetch
        const currentRoundResult = await publicClient.readContract({
          address: CONTRACT_ADDRESS as Address,
          abi: GAME_ABI as unknown as Abi,
          functionName: "currentRound",
        });

        const currentRound = Number(currentRoundResult);
        
        // Get total burned
        const totalBurnedResult = await publicClient.readContract({
          address: CONTRACT_ADDRESS as Address,
          abi: GAME_ABI as unknown as Abi,
          functionName: "totalBurned",
        });

        // Fetch all completed rounds (currentRound - 1 down to 1)
        const completedRounds: RoundResult[] = [];
        let totalPot = 0n;
        let biggestWin = 0n;

        // Fetch in batches of 5 to avoid RPC limits
        for (let round = currentRound - 1; round >= 1; round--) {
          try {
            const result = await publicClient.readContract({
              address: CONTRACT_ADDRESS as Address,
              abi: GAME_ABI as unknown as Abi,
              functionName: "getRoundResult",
              args: [BigInt(round)],
            });

            const [winner, potSize, winnerPayout, burned, endTime] = result as [string, bigint, bigint, bigint, bigint];
            
            // Skip empty rounds (not played)
            if (winner !== "0x0000000000000000000000000000000000000000") {
              completedRounds.push({
                round,
                winner,
                potSize,
                winnerPayout,
                burned,
                endTime,
              });
              totalPot += potSize;
              if (winnerPayout > biggestWin) biggestWin = winnerPayout;
            }
          } catch (e) {
            console.warn(`Failed to fetch round ${round}:`, e);
          }
        }

        setRounds(completedRounds);
        
        if (completedRounds.length > 0) {
          setStats({
            totalRounds: completedRounds.length,
            totalPot,
            totalBurned: totalBurnedResult as bigint,
            biggestWin,
            averagePot: totalPot / BigInt(completedRounds.length),
          });
        }
      } catch (err) {
        console.error("Failed to fetch history:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [publicClient]);

  const formatDate = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const visibleRounds = rounds.slice(0, visibleCount);
  const hasMore = visibleCount < rounds.length;

  return (
    <div className="fomo-page">
      <div className="crt-overlay" />
      
      <div className="fomo-container">
        {/* Title */}
        <div className="fomo-title-section">
          <h1 className="fomo-title">
            <span className="fomo-emoji">📜</span> ROUND HISTORY <span className="fomo-emoji">📜</span>
          </h1>
          <p className="fomo-subtitle">Every King. Every Pot. Every Burn.</p>
        </div>

        {/* Stats Overview */}
        {stats && (
          <div className="fomo-card">
            <h2 className="fomo-section-title">🏆 ALL-TIME STATS</h2>
            <div className="fomo-stats-grid">
              <div className="fomo-stat-box">
                <div className="fomo-stat-label">ROUNDS PLAYED</div>
                <div className="fomo-stat-value">{stats.totalRounds}</div>
              </div>
              <div className="fomo-stat-box">
                <div className="fomo-stat-label">TOTAL POT</div>
                <div className="fomo-stat-value">{formatClawd(stats.totalPot)}</div>
              </div>
              <div className="fomo-stat-box">
                <div className="fomo-stat-label">BIGGEST WIN</div>
                <div className="fomo-stat-value fomo-accent-green">{formatClawd(stats.biggestWin)}</div>
              </div>
              <div className="fomo-stat-box">
                <div className="fomo-stat-label">AVERAGE POT</div>
                <div className="fomo-stat-value">{formatClawd(stats.averagePot)}</div>
              </div>
              <div className="fomo-stat-box">
                <div className="fomo-stat-label">TOTAL BURNED 🔥</div>
                <div className="fomo-stat-value fomo-burn-value">{formatClawd(stats.totalBurned)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Round List */}
        <div className="fomo-card">
          <h2 className="fomo-section-title">🎮 PAST ROUNDS</h2>
          
          {isLoading ? (
            <div className="fomo-loading">
              <span className="loading loading-spinner loading-lg"></span>
              <p>Loading history...</p>
            </div>
          ) : rounds.length === 0 ? (
            <div className="fomo-empty">
              <p>No completed rounds yet. Be the first winner! 👑</p>
            </div>
          ) : (
            <>
              <div className="round-list">
                {visibleRounds.map((r) => (
                  <div key={r.round} className="round-item">
                    <div className="round-header">
                      <span className="round-number">ROUND #{r.round}</span>
                      <span className="round-date">{formatDate(r.endTime)}</span>
                    </div>
                    
                    <div className="round-details">
                      <div className="round-winner">
                        <span className="round-label">👑 WINNER</span>
                        <span className="round-winner-addr">{shortAddr(r.winner)}</span>
                      </div>
                      
                      <div className="round-stats-row">
                        <div className="round-stat">
                          <span className="round-label">💰 POT</span>
                          <span className="round-value">{formatClawd(r.potSize)}</span>
                        </div>
                        <div className="round-stat">
                          <span className="round-label">🏆 PAYOUT</span>
                          <span className="round-value fomo-accent-green">{formatClawd(r.winnerPayout)}</span>
                        </div>
                        <div className="round-stat">
                          <span className="round-label">🔥 BURNED</span>
                          <span className="round-value fomo-burn-value">{formatClawd(r.burned)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {hasMore && (
                <button 
                  className="fomo-load-more"
                  onClick={() => setVisibleCount(prev => prev + 10)}
                >
                  Load More Rounds ↓
                </button>
              )}
            </>
          )}
        </div>

        {/* Back to Game */}
        <a href="/" className="fomo-back-link">
          ← Back to Current Round
        </a>
      </div>

      <style jsx>{`
        .round-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        
        .round-item {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid #333;
          border-radius: 12px;
          padding: 1rem;
          transition: all 0.2s;
        }
        
        .round-item:hover {
          border-color: #ff4500;
          background: rgba(255, 69, 0, 0.05);
        }
        
        .round-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid #333;
        }
        
        .round-number {
          font-weight: bold;
          font-size: 1.1rem;
          color: #ff4500;
        }
        
        .round-date {
          font-size: 0.85rem;
          color: #888;
        }
        
        .round-details {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        
        .round-winner {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .round-winner-addr {
          font-family: monospace;
          background: rgba(255, 69, 0, 0.2);
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.9rem;
        }
        
        .round-stats-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
          margin-top: 0.5rem;
        }
        
        .round-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        
        .round-label {
          font-size: 0.75rem;
          color: #888;
          margin-bottom: 0.25rem;
        }
        
        .round-value {
          font-weight: bold;
          font-size: 1rem;
        }
        
        .fomo-load-more {
          width: 100%;
          padding: 1rem;
          margin-top: 1rem;
          background: transparent;
          border: 2px dashed #444;
          border-radius: 8px;
          color: #888;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .fomo-load-more:hover {
          border-color: #ff4500;
          color: #ff4500;
        }
        
        .fomo-empty {
          text-align: center;
          padding: 2rem;
          color: #888;
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
        
        @media (max-width: 640px) {
          .round-stats-row {
            grid-template-columns: 1fr;
            gap: 0.5rem;
          }
          
          .round-stat {
            flex-direction: row;
            justify-content: space-between;
          }
        }
      `}</style>
    </div>
  );
};

export default History;
