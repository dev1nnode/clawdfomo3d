"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Abi, Address, formatUnits } from "viem";
import { useAccount, usePublicClient } from "wagmi";

/**
 * Single polling hook for ALL ClawdFomo3D game state.
 *
 * Uses ONE multicall every 3 seconds instead of N separate hooks.
 * This prevents flailing (many RPC calls/sec) and keeps a single clean loop.
 *
 * IMPORTANT: The deployed contract ABI differs from the source code!
 * - getRoundInfo() returns all state in one call
 * - getPlayer(round, addr) returns player keys + dividends
 * - calculateCost(numKeys) returns cost for N keys
 * - timeRemaining() does NOT exist — computed client-side from roundEnd
 */

const CONTRACT_ADDRESS = "0x572Bc6149a5A9b013b5e9c370aEf6Fec8388F53f" as const;

// Minimal ABI for the three view functions we need
const GAME_ABI = [
  {
    type: "function",
    name: "getRoundInfo",
    inputs: [],
    outputs: [
      { name: "currentRound", type: "uint256" },
      { name: "pot", type: "uint256" },
      { name: "roundEnd", type: "uint256" },
      { name: "lastBuyer", type: "address" },
      { name: "totalKeys", type: "uint256" },
      { name: "currentKeyPrice", type: "uint256" },
      { name: "isActive", type: "bool" },
      { name: "totalBurned", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getPlayer",
    inputs: [
      { name: "round", type: "uint256" },
      { name: "player", type: "address" },
    ],
    outputs: [
      { name: "keys", type: "uint256" },
      { name: "dividends", type: "uint256" },
      { name: "withdrawn", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "calculateCost",
    inputs: [{ name: "numKeys", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export interface GameState {
  // Global state (from getRoundInfo)
  currentRound: bigint;
  pot: bigint;
  roundEnd: bigint;
  lastBuyer: string;
  totalKeys: bigint;
  currentKeyPrice: bigint;
  isActive: boolean;
  totalBurned: bigint;
  // Computed
  timeRemaining: number; // seconds, computed client-side
  // Player state (from getPlayer)
  playerKeys: bigint;
  playerDividends: bigint;
  playerWithdrawn: bigint;
  // Dynamic (from calculateCost)
  costForKeys: bigint;
  // Meta
  isLoading: boolean;
  error: string | undefined;
  lastPollTime: number;
}

const INITIAL_STATE: GameState = {
  currentRound: 0n,
  pot: 0n,
  roundEnd: 0n,
  lastBuyer: "0x0000000000000000000000000000000000000000",
  totalKeys: 0n,
  currentKeyPrice: 0n,
  isActive: false,
  totalBurned: 0n,
  timeRemaining: 0,
  playerKeys: 0n,
  playerDividends: 0n,
  playerWithdrawn: 0n,
  costForKeys: 0n,
  isLoading: true,
  error: undefined,
  lastPollTime: 0,
};

const POLL_INTERVAL = 3000; // 3 seconds

export function useGameState(numKeys: string): GameState {
  const { address: connectedAddress } = useAccount();
  const publicClient = usePublicClient({ chainId: 8453 });

  const [state, setState] = useState<GameState>(INITIAL_STATE);

  // Refs to avoid re-creating the interval
  const numKeysRef = useRef(numKeys);
  numKeysRef.current = numKeys;
  const addressRef = useRef(connectedAddress);
  addressRef.current = connectedAddress;

  const fetchState = useCallback(async () => {
    if (!publicClient) return;

    try {
      const keys = BigInt(numKeysRef.current || "1");

      // === BATCH 1: Global state + cost (always needed) ===
      const globalCalls = [
        {
          address: CONTRACT_ADDRESS as Address,
          abi: GAME_ABI as unknown as Abi,
          functionName: "getRoundInfo",
        },
        {
          address: CONTRACT_ADDRESS as Address,
          abi: GAME_ABI as unknown as Abi,
          functionName: "calculateCost",
          args: [keys],
        },
      ];

      const globalResults = await publicClient.multicall({ contracts: globalCalls });

      // Parse getRoundInfo
      const roundInfo = globalResults[0];
      if (roundInfo.status !== "success" || !Array.isArray(roundInfo.result)) {
        throw new Error("getRoundInfo failed: " + (roundInfo as any)?.error?.message);
      }

      const [currentRound, pot, roundEnd, lastBuyer, totalKeys, currentKeyPrice, isActive, totalBurned] =
        roundInfo.result as [bigint, bigint, bigint, string, bigint, bigint, boolean, bigint];

      // Parse calculateCost
      const costResult = globalResults[1];
      const costForKeys = costResult.status === "success" ? (costResult.result as bigint) : 0n;

      // Compute time remaining client-side
      const now = Math.floor(Date.now() / 1000);
      const timeRemaining = Number(roundEnd) > now ? Number(roundEnd) - now : 0;

      // === BATCH 2: Player state (only if connected) ===
      let playerKeys = 0n;
      let playerDividends = 0n;
      let playerWithdrawn = 0n;

      const addr = addressRef.current;
      if (addr && currentRound > 0n) {
        try {
          const playerResult = await publicClient.multicall({
            contracts: [
              {
                address: CONTRACT_ADDRESS as Address,
                abi: GAME_ABI as unknown as Abi,
                functionName: "getPlayer",
                args: [currentRound, addr],
              },
            ],
          });

          if (playerResult[0].status === "success" && Array.isArray(playerResult[0].result)) {
            [playerKeys, playerDividends, playerWithdrawn] = playerResult[0].result as [bigint, bigint, bigint];
          }
        } catch (e) {
          console.warn("[useGameState] player fetch error:", e);
        }
      }

      setState({
        currentRound,
        pot,
        roundEnd,
        lastBuyer,
        totalKeys,
        currentKeyPrice,
        isActive,
        totalBurned,
        timeRemaining,
        playerKeys,
        playerDividends,
        playerWithdrawn,
        costForKeys,
        isLoading: false,
        error: undefined,
        lastPollTime: Date.now(),
      });
    } catch (err: any) {
      console.error("[useGameState] poll error:", err);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err.message || "Failed to read contract",
      }));
    }
  }, [publicClient]);

  // === Single polling loop ===
  useEffect(() => {
    if (!publicClient) return;

    // Fetch immediately
    fetchState();

    // Poll every 3 seconds
    const interval = setInterval(fetchState, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [publicClient, fetchState]);

  // === Client-side countdown between polls ===
  useEffect(() => {
    if (state.roundEnd === 0n) return;

    const tick = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = Number(state.roundEnd) > now ? Number(state.roundEnd) - now : 0;
      setState(prev => ({ ...prev, timeRemaining: remaining }));
    };

    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [state.roundEnd]);

  return state;
}

// ============ Formatting Helpers ============

export function formatClawd(val: bigint | undefined | null): string {
  if (!val || val === 0n) return "0";
  const num = Number(formatUnits(val, 18));
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + "M";
  if (num >= 10_000) return (num / 1_000).toFixed(1) + "K";
  if (num >= 1_000) return (num / 1_000).toFixed(2) + "K";
  if (num >= 1) return num.toFixed(0);
  return num.toFixed(2);
}

export function formatTimer(seconds: number): string {
  if (seconds <= 0) return "00:00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function shortAddr(addr: string | undefined): string {
  if (!addr || addr === "0x0000000000000000000000000000000000000000") return "Nobody";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}
