/**
 * ClawdFomo3D external contract on Base mainnet.
 * ABI reverse-engineered from the DEPLOYED bytecode at 0x572Bc6149a5A9b013b5e9c370aEf6Fec8388F53f
 * (The source code in /packages/foundry was updated AFTER deployment — function names differ!)
 */
import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

const externalContracts = {
  8453: {
    ClawdFomo3D: {
      address: "0x572Bc6149a5A9b013b5e9c370aEf6Fec8388F53f",
      abi: [
        // ============ View: Batch Getters ============
        {
          type: "function",
          name: "getRoundInfo",
          inputs: [],
          outputs: [
            { name: "currentRound", type: "uint256", internalType: "uint256" },
            { name: "pot", type: "uint256", internalType: "uint256" },
            { name: "roundEnd", type: "uint256", internalType: "uint256" },
            { name: "lastBuyer", type: "address", internalType: "address" },
            { name: "totalKeys", type: "uint256", internalType: "uint256" },
            { name: "currentKeyPrice", type: "uint256", internalType: "uint256" },
            { name: "isActive", type: "bool", internalType: "bool" },
            { name: "totalBurned", type: "uint256", internalType: "uint256" },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "getPlayer",
          inputs: [
            { name: "round", type: "uint256", internalType: "uint256" },
            { name: "player", type: "address", internalType: "address" },
          ],
          outputs: [
            { name: "keys", type: "uint256", internalType: "uint256" },
            { name: "dividends", type: "uint256", internalType: "uint256" },
            { name: "withdrawn", type: "uint256", internalType: "uint256" },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "calculateCost",
          inputs: [{ name: "numKeys", type: "uint256", internalType: "uint256" }],
          outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "getRoundResult",
          inputs: [{ name: "round", type: "uint256", internalType: "uint256" }],
          outputs: [
            {
              name: "",
              type: "tuple",
              internalType: "struct ClawdFomo3D.RoundResult",
              components: [
                { name: "winner", type: "address", internalType: "address" },
                { name: "potSize", type: "uint256", internalType: "uint256" },
                { name: "winnerPayout", type: "uint256", internalType: "uint256" },
                { name: "burned", type: "uint256", internalType: "uint256" },
                { name: "endTime", type: "uint256", internalType: "uint256" },
              ],
            },
          ],
          stateMutability: "view",
        },
        // ============ View: Individual Getters ============
        {
          type: "function",
          name: "pot",
          inputs: [],
          outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "totalKeys",
          inputs: [],
          outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "currentRound",
          inputs: [],
          outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "lastBuyer",
          inputs: [],
          outputs: [{ name: "", type: "address", internalType: "address" }],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "currentKeyPrice",
          inputs: [],
          outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "roundEnd",
          inputs: [],
          outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "roundStart",
          inputs: [],
          outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "totalBurned",
          inputs: [],
          outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "clawd",
          inputs: [],
          outputs: [{ name: "", type: "address", internalType: "contract IERC20" }],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "timerDuration",
          inputs: [],
          outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "paused",
          inputs: [],
          outputs: [{ name: "", type: "bool", internalType: "bool" }],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "owner",
          inputs: [],
          outputs: [{ name: "", type: "address", internalType: "address" }],
          stateMutability: "view",
        },
        // ============ View: Constants ============
        {
          type: "function",
          name: "BURN_ON_BUY_BPS",
          inputs: [],
          outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "WINNER_BPS",
          inputs: [],
          outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "BURN_ON_END_BPS",
          inputs: [],
          outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "DIVIDENDS_BPS",
          inputs: [],
          outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "BASE_PRICE",
          inputs: [],
          outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "PRICE_INCREMENT",
          inputs: [],
          outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "BPS",
          inputs: [],
          outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "ANTI_SNIPE_THRESHOLD",
          inputs: [],
          outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "ANTI_SNIPE_EXTENSION",
          inputs: [],
          outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "DEAD",
          inputs: [],
          outputs: [{ name: "", type: "address", internalType: "address" }],
          stateMutability: "view",
        },
        // ============ Write Functions ============
        {
          type: "function",
          name: "buyKeys",
          inputs: [{ name: "numKeys", type: "uint256", internalType: "uint256" }],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "endRound",
          inputs: [],
          outputs: [],
          stateMutability: "nonpayable",
        },
        {
          type: "function",
          name: "claimDividends",
          inputs: [{ name: "round", type: "uint256", internalType: "uint256" }],
          outputs: [],
          stateMutability: "nonpayable",
        },
        // ============ Events ============
        {
          type: "event",
          name: "KeysPurchased",
          inputs: [
            { name: "round", type: "uint256", indexed: true, internalType: "uint256" },
            { name: "buyer", type: "address", indexed: true, internalType: "address" },
            { name: "keys", type: "uint256", indexed: false, internalType: "uint256" },
            { name: "cost", type: "uint256", indexed: false, internalType: "uint256" },
            { name: "burned", type: "uint256", indexed: false, internalType: "uint256" },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "RoundEnded",
          inputs: [
            { name: "round", type: "uint256", indexed: true, internalType: "uint256" },
            { name: "winner", type: "address", indexed: true, internalType: "address" },
            { name: "payout", type: "uint256", indexed: false, internalType: "uint256" },
            { name: "burned", type: "uint256", indexed: false, internalType: "uint256" },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "DividendsClaimed",
          inputs: [
            { name: "round", type: "uint256", indexed: true, internalType: "uint256" },
            { name: "player", type: "address", indexed: true, internalType: "address" },
            { name: "amount", type: "uint256", indexed: false, internalType: "uint256" },
          ],
          anonymous: false,
        },
        {
          type: "event",
          name: "RoundStarted",
          inputs: [
            { name: "round", type: "uint256", indexed: true, internalType: "uint256" },
            { name: "endTime", type: "uint256", indexed: false, internalType: "uint256" },
          ],
          anonymous: false,
        },
      ],
    },
  },
} as const;

export default externalContracts satisfies GenericContractsDeclaration;
