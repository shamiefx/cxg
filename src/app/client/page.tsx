"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useBalance, usePublicClient } from "wagmi";
import { useEffect, useMemo, useState } from "react";
import { formatEther, parseEther, parseUnits, formatUnits, isAddress } from "viem";
import { getFirebase } from "@/lib/firebase/client";
import { collection, doc, serverTimestamp, setDoc, getDocs, query, orderBy, limit } from "firebase/firestore";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import Providers from "@/components/providers";

// Deployed addresses (BSC Mainnet)
// NOTE: Ensure this address matches the referral-enabled Sale contract that exposes:
//   buyWithBNB(address sponsor)
//   buyWithUSDT(uint256 amount, address sponsor)
// If you still point to the legacy sale (buyWithBNB(address,uint256)), set NEXT_PUBLIC_SALE_ADDRESS accordingly
// and revert to legacy ABI logic or deploy the new contract.
// Branding cleanup: we previously hard‑coded "CXG+". Now we allow token symbol & name overrides via env.
//   NEXT_PUBLIC_TOKEN_SYMBOL (e.g. "CXGP")
//   NEXT_PUBLIC_TOKEN_NAME   (e.g. "Token for Gold")
// Fallbacks preserve existing UI if env vars not provided.
const TOKEN_SYMBOL = (process.env.NEXT_PUBLIC_TOKEN_SYMBOL || "CXGP").trim();
const TOKEN_NAME = (process.env.NEXT_PUBLIC_TOKEN_NAME || "Coin of Gold").trim();
const SALE = (process.env.NEXT_PUBLIC_SALE_ADDRESS as `0x${string}` | undefined) || "0x02b0364a53f2D82d8EcBB4ccF058A44784f0dc3c" as const;
const USDT = "0x55d398326f99059fF775485246999027B3197955" as `0x${string}`; // 18 decimals on BSC
const CXG = ((process.env.NEXT_PUBLIC_CXG_TOKEN_ADDRESS as `0x${string}` | undefined) ||
  "0xA63F08a32639689DfF7b89FC5C12fF89dC687B34") as `0x${string}`;

// Minimal ABIs
const saleAbi = [
  { type: "function", name: "buyWithBNB", inputs: [ { name: "sponsor", type: "address" } ], outputs: [], stateMutability: "payable" },
  { type: "function", name: "buyWithUSDT", inputs: [ { name: "usdtAmount", type: "uint256" }, { name: "sponsor", type: "address" } ], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "quoteTokensForBNB", inputs: [ { name: "wei", type: "uint256" } ], outputs: [ { name: "tokensGross", type: "uint256" } ], stateMutability: "view" },
  { type: "function", name: "quoteTokensForUSDT", inputs: [ { name: "usdtAmount", type: "uint256" } ], outputs: [ { name: "tokensGross", type: "uint256" } ], stateMutability: "view" },
  { type: "function", name: "quoteReferralSplit", inputs: [ { name: "tokensGross", type: "uint256" } ], outputs: [ { name: "net", type: "uint256" }, { name: "r1", type: "uint256" }, { name: "r2", type: "uint256" }, { name: "r3", type: "uint256" } ], stateMutability: "view" },
  { type: "function", name: "getUplines", inputs: [ { name: "user", type: "address" } ], outputs: [ { name: "l1", type: "address" }, { name: "l2", type: "address" }, { name: "l3", type: "address" } ], stateMutability: "view" },
] as const;

const erc20Abi = [
  { type: "function", name: "decimals", inputs: [], outputs: [ { type: "uint8" } ], stateMutability: "view" },
  { type: "function", name: "approve", inputs: [ { name: "spender", type: "address" }, { name: "amount", type: "uint256" } ], outputs: [ { type: "bool" } ], stateMutability: "nonpayable" },
  { type: "function", name: "balanceOf", inputs: [ { name: "account", type: "address" } ], outputs: [ { type: "uint256" } ], stateMutability: "view" },
  { type: "function", name: "totalSupply", inputs: [], outputs: [ { type: "uint256" } ], stateMutability: "view" },
] as const;

type Tx = { id: string; type: string; inputCurrency?: string; inputAmount?: string; cxgExpected?: string; gross?: string; r1?: string; r2?: string; r3?: string; hash: string };
type TxMeta = { blockNumber?: string; gasUsed?: string; effectiveGasPrice?: string; status?: string };

// Extract a readable error message from various library error shapes without using `any`
type MsgErrorShape = { shortMessage?: string; details?: string; message?: string };
function extractErrMsg(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const e = err as MsgErrorShape;
    return e.shortMessage || e.details || e.message || "Transaction failed";
  }
  return "Transaction failed";
}

// Chart removed per request

function ClientContent() {
  const { address, isConnected } = useAccount();
  // Referral sponsor state
  const [sponsor, setSponsor] = useState("");
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
  const sponsorAddr = useMemo(() => (sponsor && isAddress(sponsor) ? sponsor : ZERO_ADDRESS) as `0x${string}` , [sponsor]);
  const publicClient = usePublicClient();
  const { auth, db } = getFirebase();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [recentTxs, setRecentTxs] = useState<Tx[]>([]);
  const [lastSuccess, setLastSuccess] = useState<{ tx: Tx; meta?: TxMeta } | null>(null);
  const [holderCount, setHolderCount] = useState<number | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setChecking(false);
    });
    return () => unsub();
  }, [auth]);

  useEffect(() => {
    if (!checking && !user) {
      router.replace("/signin");
    }
  }, [checking, user, router]);

  // Balances
  const { data: bnbBal } = useBalance({ address, chainId: 56, query: { enabled: !!address } });
  const { data: usdtBal } = useBalance({ address, token: USDT, chainId: 56, query: { enabled: !!address } });
  const { data: cxgBal } = useBalance({ address, token: CXG, chainId: 56, query: { enabled: !!address && !!CXG } });

  const bnbBalanceWei = bnbBal?.value ?? 0n;
  const usdtBalanceWei = usdtBal?.value ?? 0n;
  // Format decimal strings to exactly `decimals` fraction digits with thousands separators (no precision loss)
  const fmtFixed = (valueStr: string, decimals: number) => {
    const parts = valueStr.split(".");
    const intRaw = parts[0] || "0";
    const fracRaw = parts[1] || "";
    const frac = (fracRaw + "0".repeat(decimals)).slice(0, decimals);
    const int = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `${int}.${frac}`;
  };
  const bnbFormatted18 = useMemo(() => {
    if (!bnbBal) return "—";
    const s = formatUnits(bnbBal.value, bnbBal.decimals);
    return fmtFixed(s, 8);
  }, [bnbBal]);
  const usdtFormatted18 = useMemo(() => {
    if (!usdtBal) return "—";
    const s = formatUnits(usdtBal.value, usdtBal.decimals);
    return fmtFixed(s, 8);
  }, [usdtBal]);
  const cxgFormatted18 = useMemo(() => {
    if (!cxgBal) return (CXG ? "—" : "Set NEXT_PUBLIC_CXG_TOKEN_ADDRESS");
    const s = formatUnits(cxgBal.value, cxgBal.decimals);
    return fmtFixed(s, 8);
  }, [cxgBal]);
  const BNB_SPEND_CAP_PCT = 80n; // 80%
  const GAS_PAD_PCT = 20n; // +20% buffer

  // BNB flow state
  const [bnbIn, setBnbIn] = useState("");
  const bnbWei = useMemo(() => {
    try { return parseEther(bnbIn || "0"); } catch { return 0n; }
  }, [bnbIn]);
  // OLD bnbCxgOut logic replaced below
  const bnbGrossQuote = useReadContract({
    address: SALE,
    abi: saleAbi,
    functionName: "quoteTokensForBNB",
    args: [bnbWei],
    query: { enabled: bnbWei > 0n },
  }) as { data?: bigint };
  const bnbGrossTokens = bnbGrossQuote.data ?? 0n;
  const bnbSplitQuote = useReadContract({
    address: SALE,
    abi: saleAbi,
    functionName: "quoteReferralSplit",
    args: [bnbGrossTokens],
    query: { enabled: bnbGrossTokens > 0n },
  }) as { data?: readonly bigint[] };
  const bnbNetTokens = bnbSplitQuote.data ? bnbSplitQuote.data[0] : 0n;
  const bnbR1 = bnbSplitQuote.data ? bnbSplitQuote.data[1] : 0n;
  const bnbR2 = bnbSplitQuote.data ? bnbSplitQuote.data[2] : 0n;
  const bnbR3 = bnbSplitQuote.data ? bnbSplitQuote.data[3] : 0n;

  // Remaining supply
  // (removed balanceOf(SALE) supply tracking)
  const { data: cxgTotalSupplyRaw } = useReadContract({
    address: CXG,
    abi: erc20Abi,
    functionName: "totalSupply",
    chainId: 56,
    query: { enabled: !!CXG },
  });
  const { data: cxgDecimalsRaw } = useReadContract({
    address: CXG,
    abi: erc20Abi,
    functionName: "decimals",
    chainId: 56,
    query: { enabled: !!CXG },
  });
  // Token supply (for display only; purchases do not enforce supply caps)
  // totalSupplyWei available if needed for future logic

  // Displayed Supply: token totalSupply (from contract), formatted 4dp
  const supplyFormatted18 = useMemo(() => {
    if (cxgTotalSupplyRaw) {
      const d = typeof cxgDecimalsRaw === "number" ? cxgDecimalsRaw : (cxgDecimalsRaw ? Number(cxgDecimalsRaw as unknown as bigint) : 18);
      const s = formatUnits(cxgTotalSupplyRaw as bigint, d);
      return fmtFixed(s, 8);
    }
    return "—";
  }, [cxgTotalSupplyRaw, cxgDecimalsRaw]);

  // Holders count (prefer BscScan; fallback to Etherscan v2)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const keyEth = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY;
        const keyBsc = process.env.NEXT_PUBLIC_BSCSCAN_API_KEY;
        if (!CXG) { if (!cancelled) setHolderCount(null); return; }
        let count: number | null = null;
        // 1) Try BscScan v1 if key present
        if (keyBsc) {
          const urlV1 = `https://api.bscscan.com/api?module=token&action=tokenholdercount&contractaddress=${CXG}&apikey=${keyBsc}`;
          try {
            const r1 = await fetch(urlV1);
            if (r1.ok) {
              const j1 = await r1.json();
              if (j1 && j1.status === "1" && j1.result) {
                const n = Number(j1.result);
                if (Number.isFinite(n)) count = n;
              }
            }
          } catch { /* ignore */ }
        }
        // 2) Fallback to Etherscan v2 multi-chain if needed
        if ((count === null || !Number.isFinite(count)) && keyEth) {
          const urlV2 = `https://api.etherscan.io/v2/api?chainid=56&module=token&action=tokenholdercount&contractaddress=${CXG}&apikey=${keyEth}`;
          try {
            const res = await fetch(urlV2);
            if (res.ok) {
              const json = await res.json();
              const val = (json && (json.result ?? json.data ?? json.count)) as unknown;
              if (typeof val === "string") count = Number(val);
              if (typeof val === "number") count = val;
            }
          } catch { /* ignore */ }
        }
        if (!cancelled) setHolderCount((count !== null && Number.isFinite(count)) ? count : null);
      } catch {
        if (!cancelled) setHolderCount(null);
      }
    }
    load();
    const t = setInterval(load, 120000); // refresh every 2 minutes
    return () => { cancelled = true; clearInterval(t); };
  }, []);
  const holdersDisplay = useMemo(() => holderCount !== null ? holderCount.toLocaleString() : "—", [holderCount]);

  // Quote per 1 BNB/USDT was used for max-by-supply; removed to avoid unused reads

  // Gas estimation state
  const [gasPriceWei, setGasPriceWei] = useState<bigint | null>(null);
  const [bnbBuyGasUnits, setBnbBuyGasUnits] = useState<bigint | null>(null);
  const [usdtApproveGasUnits, setUsdtApproveGasUnits] = useState<bigint | null>(null);
  const [usdtBuyGasUnits, setUsdtBuyGasUnits] = useState<bigint | null>(null);
  // Error surfaces
  const [bnbError, setBnbError] = useState<string | null>(null);
  const [usdtError, setUsdtError] = useState<string | null>(null);

  // Fetch gas price periodically when connected
  useEffect(() => {
    let stop = false;
    async function load() {
      try {
        if (!publicClient) return;
        const gp = await publicClient.getGasPrice();
        if (!stop) setGasPriceWei(gp);
      } catch {
        // ignore
      }
    }
    if (isConnected) {
      load();
      const t = setInterval(load, 15000);
      return () => { stop = true; clearInterval(t); };
    }
  }, [publicClient, isConnected]);

  // Estimate gas for BNB buy
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        if (!publicClient || !address || bnbWei <= 0n) { setBnbBuyGasUnits(null); return; }
        const units = await publicClient.estimateContractGas({
          account: address,
          address: SALE,
          abi: saleAbi,
          functionName: "buyWithBNB",
          args: [sponsorAddr],
          value: bnbWei,
        });
        if (!ignore) setBnbBuyGasUnits(units);
      } catch {
        if (!ignore) setBnbBuyGasUnits(null);
      }
    })();
    return () => { ignore = true; };
  }, [publicClient, address, bnbWei, sponsorAddr]);

  // Derived gas costs in BNB (wei)
  const bnbBuyGasCostWei = useMemo(() => (bnbBuyGasUnits && gasPriceWei) ? bnbBuyGasUnits * gasPriceWei : null, [bnbBuyGasUnits, gasPriceWei]);
  const bnbBuyGasCostPaddedWei = useMemo(() => bnbBuyGasCostWei ? (bnbBuyGasCostWei * (100n + GAS_PAD_PCT)) / 100n : null, [bnbBuyGasCostWei, GAS_PAD_PCT]);
  // const bnbGasLimitPadded = useMemo(() => bnbBuyGasUnits ? (bnbBuyGasUnits * (100n + GAS_PAD_PCT)) / 100n : null, [bnbBuyGasUnits, GAS_PAD_PCT]);

  // Enforce 80% cap for BNB spend
  const bnbCapWei = useMemo(() => (bnbBalanceWei * BNB_SPEND_CAP_PCT) / 100n, [bnbBalanceWei, BNB_SPEND_CAP_PCT]);
  const bnbOverCap = bnbWei > 0n && bnbWei > bnbCapWei;

  // Enforce remaining supply cap for BNB path
  // supply caps not enforced
  // No supply cap enforced for BNB purchases (token is mintable)

  const { writeContractAsync: writeAsyncBNB, isPending: isPendingBNB } = useWriteContract();
  const [bnbHash, setBnbHash] = useState<`0x${string}` | undefined>(undefined);
  const { isLoading: bnbIsConfirming, isSuccess: bnbIsConfirmed, data: bnbReceipt } = useWaitForTransactionReceipt({ hash: bnbHash });

  async function handleBuyBNB() {
    if (!isConnected || !address || bnbWei <= 0n) return;
    try {
      setBnbError(null);
      if (publicClient) {
        await publicClient.simulateContract({
          account: address,
          address: SALE,
          abi: saleAbi,
          functionName: "buyWithBNB",
          args: [sponsorAddr],
          value: bnbWei,
        });
      }
      const hash = await writeAsyncBNB({
        address: SALE,
        abi: saleAbi,
        functionName: "buyWithBNB",
        args: [sponsorAddr],
        value: bnbWei,
      });
      setBnbHash(hash);
    } catch (e) {
      console.error(e);
      setBnbError(extractErrMsg(e));
    }
  }

  // Log BNB purchase success to Firestore (once)
  useEffect(() => {
    if (!bnbIsConfirmed || !bnbHash || !user || !address) return;
    (async () => {
      try {
        const meta: TxMeta = bnbReceipt ? {
          blockNumber: bnbReceipt.blockNumber ? bnbReceipt.blockNumber.toString() : undefined,
          gasUsed: bnbReceipt.gasUsed ? bnbReceipt.gasUsed.toString() : undefined,
          effectiveGasPrice: bnbReceipt.effectiveGasPrice ? bnbReceipt.effectiveGasPrice.toString() : undefined,
          status: bnbReceipt.status ?? undefined,
        } : {};
        const txDoc = {
          type: "BUY_BNB",
          walletAddress: address,
          inputCurrency: "BNB",
          inputAmount: bnbIn,
          cxgExpected: bnbNetTokens ? Number(formatEther(bnbNetTokens)).toString() : null,
          gross: bnbGrossTokens ? Number(formatEther(bnbGrossTokens)).toString() : null,
          r1: bnbR1 ? Number(formatEther(bnbR1)).toString() : null,
          r2: bnbR2 ? Number(formatEther(bnbR2)).toString() : null,
          r3: bnbR3 ? Number(formatEther(bnbR3)).toString() : null,
          hash: bnbHash,
          status: "success",
          ...meta,
          createdAt: serverTimestamp(),
        } as const;
        const txRef = doc(db, "users", user.uid, "transactions", bnbHash);
        await setDoc(txRef, txDoc, { merge: true });
        // update immediate UI card
        setLastSuccess({
          tx: { id: bnbHash, type: "BUY_BNB", inputCurrency: "BNB", inputAmount: bnbIn, cxgExpected: txDoc.cxgExpected ?? undefined, gross: txDoc.gross ?? undefined, r1: txDoc.r1 ?? undefined, r2: txDoc.r2 ?? undefined, r3: txDoc.r3 ?? undefined, hash: bnbHash },
          meta,
        });
      } catch (e) {
        console.error("log BUY_BNB failed", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bnbIsConfirmed, bnbHash, bnbReceipt]);

  // USDT flow state
  const [usdtIn, setUsdtIn] = useState("");
  const usdtAmt = useMemo(() => {
    try { return parseUnits(usdtIn || "0", 18); } catch { return 0n; }
  }, [usdtIn]);
  const usdtGrossQuote = useReadContract({
    address: SALE,
    abi: saleAbi,
    functionName: "quoteTokensForUSDT",
    args: [usdtAmt],
    query: { enabled: usdtAmt > 0n },
  }) as { data?: bigint };
  const usdtGrossTokens = usdtGrossQuote.data ?? 0n;
  const usdtSplitQuote = useReadContract({
    address: SALE,
    abi: saleAbi,
    functionName: "quoteReferralSplit",
    args: [usdtGrossTokens],
    query: { enabled: usdtGrossTokens > 0n },
  }) as { data?: readonly bigint[] };
  const usdtNetTokens = usdtSplitQuote.data ? usdtSplitQuote.data[0] : 0n;
  const usdtR1 = usdtSplitQuote.data ? usdtSplitQuote.data[1] : 0n;
  const usdtR2 = usdtSplitQuote.data ? usdtSplitQuote.data[2] : 0n;
  const usdtR3 = usdtSplitQuote.data ? usdtSplitQuote.data[3] : 0n;

  // Removed per-1 USDT quote (unused)
  // supply caps not enforced
  // No supply cap enforced for USDT purchases (token is mintable)

  // Estimate gas for USDT approve + buy
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!publicClient || !address || usdtAmt <= 0n) { setUsdtApproveGasUnits(null); setUsdtBuyGasUnits(null); return; }
        const approveUnits = await publicClient.estimateContractGas({
          account: address,
          address: USDT,
          abi: erc20Abi,
          functionName: "approve",
          args: [SALE, usdtAmt],
        });
        const buyUnits = await publicClient.estimateContractGas({
            account: address,
            address: SALE,
            abi: saleAbi,
            functionName: "buyWithUSDT",
            args: [usdtAmt, sponsorAddr],
        });
        if (!cancelled) { setUsdtApproveGasUnits(approveUnits); setUsdtBuyGasUnits(buyUnits); }
      } catch {
        if (!cancelled) { setUsdtApproveGasUnits(null); setUsdtBuyGasUnits(null); }
      }
    })();
    return () => { cancelled = true; };
  }, [publicClient, address, usdtAmt, sponsorAddr]);

  const usdtTotalGasUnits = useMemo(() => (usdtApproveGasUnits ?? 0n) + (usdtBuyGasUnits ?? 0n), [usdtApproveGasUnits, usdtBuyGasUnits]);
  const usdtTotalGasCostWei = useMemo(() => (gasPriceWei ? usdtTotalGasUnits * gasPriceWei : null), [usdtTotalGasUnits, gasPriceWei]);
  const usdtTotalGasCostPaddedWei = useMemo(() => usdtTotalGasCostWei ? (usdtTotalGasCostWei * (100n + GAS_PAD_PCT)) / 100n : null, [usdtTotalGasCostWei, GAS_PAD_PCT]);
  const hasEnoughBnbForUsdtGas = useMemo(() => (usdtTotalGasCostPaddedWei !== null) ? bnbBalanceWei >= usdtTotalGasCostPaddedWei : true, [bnbBalanceWei, usdtTotalGasCostPaddedWei]);
  const hasSomeUsdt = useMemo(() => usdtBalanceWei > 0n, [usdtBalanceWei]);
  const hasEnoughUsdt = useMemo(() => usdtAmt <= usdtBalanceWei, [usdtAmt, usdtBalanceWei]);
  // const usdtApproveGasLimitPadded = useMemo(() => usdtApproveGasUnits ? (usdtApproveGasUnits * (100n + GAS_PAD_PCT)) / 100n : null, [usdtApproveGasUnits, GAS_PAD_PCT]);
  // const usdtBuyGasLimitPadded = useMemo(() => usdtBuyGasUnits ? (usdtBuyGasUnits * (100n + GAS_PAD_PCT)) / 100n : null, [usdtBuyGasUnits, GAS_PAD_PCT]);

  const { writeContractAsync: writeAsyncUSDT, isPending: isPendingUSDT } = useWriteContract();
  const [approveHash, setApproveHash] = useState<`0x${string}` | undefined>(undefined);
  const [buyUsdtHash, setBuyUsdtHash] = useState<`0x${string}` | undefined>(undefined);
  const { isLoading: approveConfirming, isSuccess: approveConfirmed } = useWaitForTransactionReceipt({ hash: approveHash });
  const { isLoading: buyUsdtConfirming, isSuccess: buyUsdtConfirmed, data: usdtReceipt } = useWaitForTransactionReceipt({ hash: buyUsdtHash });

  async function handleBuyUSDT() {
    if (!isConnected || !address || usdtAmt <= 0n) return;
    try {
      setUsdtError(null);
      if (publicClient) {
        await publicClient.simulateContract({
          account: address,
          address: USDT,
          abi: erc20Abi,
          functionName: "approve",
          args: [SALE, usdtAmt],
        });
      }
      const h1 = await writeAsyncUSDT({
        address: USDT,
        abi: erc20Abi,
        functionName: "approve",
        args: [SALE, usdtAmt],
      });
      setApproveHash(h1);
      if (publicClient) {
        await publicClient.simulateContract({
          account: address,
          address: SALE,
          abi: saleAbi,
          functionName: "buyWithUSDT",
          args: [usdtAmt, sponsorAddr],
        });
      }
      const h2 = await writeAsyncUSDT({
        address: SALE,
        abi: saleAbi,
        functionName: "buyWithUSDT",
        args: [usdtAmt, sponsorAddr],
      });
      setBuyUsdtHash(h2);
    } catch (e) {
      console.error(e);
      setUsdtError(extractErrMsg(e));
    }
  }

  // Log USDT purchase success to Firestore (once)
  useEffect(() => {
    if (!buyUsdtConfirmed || !buyUsdtHash || !user || !address) return;
    (async () => {
      try {
        const meta: TxMeta = usdtReceipt ? {
          blockNumber: usdtReceipt.blockNumber ? usdtReceipt.blockNumber.toString() : undefined,
          gasUsed: usdtReceipt.gasUsed ? usdtReceipt.gasUsed.toString() : undefined,
          effectiveGasPrice: usdtReceipt.effectiveGasPrice ? usdtReceipt.effectiveGasPrice.toString() : undefined,
          status: usdtReceipt.status ?? undefined,
        } : {};
        const txDoc = {
          type: "BUY_USDT",
          walletAddress: address,
          inputCurrency: "USDT",
            inputAmount: usdtIn,
            cxgExpected: usdtNetTokens ? Number(formatEther(usdtNetTokens)).toString() : null,
            gross: usdtGrossTokens ? Number(formatEther(usdtGrossTokens)).toString() : null,
            r1: usdtR1 ? Number(formatEther(usdtR1)).toString() : null,
            r2: usdtR2 ? Number(formatEther(usdtR2)).toString() : null,
            r3: usdtR3 ? Number(formatEther(usdtR3)).toString() : null,
            hash: buyUsdtHash,
            status: "success",
            ...meta,
            createdAt: serverTimestamp(),
        } as const;
        const txRef = doc(db, "users", user.uid, "transactions", buyUsdtHash);
        await setDoc(txRef, txDoc, { merge: true });
        // update immediate UI card
        setLastSuccess({
          tx: { id: buyUsdtHash, type: "BUY_USDT", inputCurrency: "USDT", inputAmount: usdtIn, cxgExpected: txDoc.cxgExpected ?? undefined, gross: txDoc.gross ?? undefined, r1: txDoc.r1 ?? undefined, r2: txDoc.r2 ?? undefined, r3: txDoc.r3 ?? undefined, hash: buyUsdtHash },
          meta,
        });
      } catch (e) {
        console.error("log BUY_USDT failed", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyUsdtConfirmed, buyUsdtHash, usdtReceipt]);

  // Load recent transactions
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const q = query(collection(db, "users", user.uid, "transactions"), orderBy("createdAt", "desc"), limit(10));
        const snaps = await getDocs(q);
        type FirestoreTxDoc = Partial<Tx>;
        const rows: Tx[] = snaps.docs.map(d => {
          const data = d.data() as unknown as FirestoreTxDoc;
            return {
              id: d.id,
              type: data.type ?? "",
              inputCurrency: data.inputCurrency,
              inputAmount: data.inputAmount,
              cxgExpected: data.cxgExpected,
              gross: data.gross,
              r1: data.r1,
              r2: data.r2,
              r3: data.r3,
              hash: (data.hash as string) ?? d.id,
            };
        });
        setRecentTxs(rows);
      } catch {
        setRecentTxs([]);
      }
    })();
  }, [user, db, bnbIsConfirmed, buyUsdtConfirmed]);

  if (checking) {
    return (
      <div className="min-h-dvh grid place-items-center px-6 py-12">
        <div className="text-white/70">Checking session…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-dvh grid place-items-center px-6 py-12">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/80">
          Redirecting to sign in… <Link className="underline" href="/signin">Sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh px-6 py-12">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">
            {isConnected ? `Connected – ${TOKEN_NAME}` : `${TOKEN_NAME} Client Area`}
          </h1>
          <ConnectButton />
        </div>

        {/* Balances */}
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 md:col-span-2">
            <h2 className="text-lg font-medium">Balances</h2>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-5 gap-4 text-sm">
              {[
                { label: "BNB", value: bnbFormatted18 },
                { label: "USDT", value: usdtFormatted18 },
                { label: TOKEN_SYMBOL, value: cxgFormatted18 },
                { label: "Supply", value: supplyFormatted18 },
                { label: "Holders", value: holderCount !== null ? holdersDisplay : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg border border-white/10 p-3">
                  <div className="text-white/60">{label}</div>
                  <div className="text-white text-right">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Sponsor Input */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 md:col-span-2">
            <h2 className="text-lg font-medium">Referral Sponsor</h2>
            <p className="mt-1 text-xs text-white/60">
              Optional address of your sponsor/upline. Leave blank for none.
            </p>
            <input
              value={sponsor}
              onChange={(e) => setSponsor(e.target.value.trim())}
              placeholder="0xSponsorAddress (optional)"
              className="mt-3 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-yellow-600"
            />
            {sponsor && !isAddress(sponsor) && (
              <div className="mt-2 text-xs text-rose-400">
                Invalid address format – will fallback to no sponsor.
              </div>
            )}
            {sponsor && isAddress(sponsor) && sponsorAddr === sponsor && (
              <div className="mt-2 text-xs text-emerald-400">Valid sponsor captured.</div>
            )}
          </div>

          {/* BNB Purchase */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-medium">Buy with BNB</h2>
            <div className="mt-4 space-y-3">
              <input
                value={bnbIn}
                onChange={(e) => setBnbIn(e.target.value)}
                placeholder="0.1"
                className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 outline-none focus:ring-2 focus:ring-yellow-600"
              />
              <div className="text-sm text-white/80">
                {bnbGrossTokens > 0n
                  ? <>You will receive ~{Number(formatEther(bnbNetTokens)).toLocaleString()} {TOKEN_SYMBOL} (net)</>
                  : <>—</>}
              </div>
              <button
                onClick={handleBuyBNB}
                disabled={
                  !isConnected ||
                  bnbWei <= 0n ||
                  isPendingBNB ||
                  bnbIsConfirming ||
                  bnbOverCap
                }
                className="w-full rounded-lg bg-gradient-to-r from-yellow-500 to-amber-600 py-2.5 font-medium text-black disabled:opacity-60"
              >
                {bnbIsConfirming
                  ? "Confirming…"
                  : isPendingBNB
                  ? "Waiting wallet…"
                  : "Buy with BNB"}
              </button>
              {bnbOverCap && (
                <div className="text-xs text-red-400">
                  Amount exceeds 80% of your BNB balance.
                </div>
              )}
              {bnbBuyGasCostWei && (
                <div className="text-xs text-white/70">
                  Estimated gas: ~{Number(formatEther(bnbBuyGasCostWei)).toFixed(6)} BNB
                  {bnbBuyGasCostPaddedWei
                    ? ` (+${Number(GAS_PAD_PCT)}%: ${Number(formatEther(bnbBuyGasCostPaddedWei)).toFixed(6)} BNB)`
                    : ""}
                  . Consider keeping a minimum for gas.
                </div>
              )}
              {bnbError && (
                <div className="text-xs text-red-400 break-all">{bnbError}</div>
              )}
              {bnbIsConfirmed && (
                <div className="text-xs text-green-400">Purchase confirmed.</div>
              )}
            </div>
          </div>

          {/* USDT Purchase */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-medium">Buy with USDT</h2>
            <div className="mt-4 space-y-3">
              <input
                value={usdtIn}
                onChange={(e) => setUsdtIn(e.target.value)}
                placeholder="100"
                className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 outline-none focus:ring-2 focus:ring-yellow-600"
              />
              <div className="text-sm text-white/80">
                {usdtGrossTokens > 0n
                  ? <>You will receive ~{Number(formatEther(usdtNetTokens)).toLocaleString()} {TOKEN_SYMBOL} (net)</>
                  : <>—</>}
              </div>
              {!hasEnoughBnbForUsdtGas && (
                <div className="text-xs text-red-400">
                  Insufficient BNB for gas. Add BNB or reduce the USDT amount.
                </div>
              )}
              {hasSomeUsdt && usdtAmt > 0n && !hasEnoughUsdt && (
                <div className="text-xs text-red-400">
                  Insufficient USDT for this amount.
                </div>
              )}
              <button
                onClick={handleBuyUSDT}
                disabled={
                  !isConnected ||
                  usdtAmt <= 0n ||
                  isPendingUSDT ||
                  approveConfirming ||
                  buyUsdtConfirming ||
                  !hasEnoughBnbForUsdtGas ||
                  !hasSomeUsdt ||
                  !hasEnoughUsdt
                }
                className="w-full rounded-lg bg-gradient-to-r from-yellow-500 to-amber-600 py-2.5 font-medium text-black disabled:opacity-60"
              >
                {buyUsdtConfirming || approveConfirming
                  ? "Confirming…"
                  : isPendingUSDT
                  ? "Waiting wallet…"
                  : "Approve & Buy USDT"}
              </button>
              {usdtError && (
                <div className="text-xs text-red-400 break-all">{usdtError}</div>
              )}
              {(approveConfirmed || buyUsdtConfirmed) && (
                <div className="text-xs text-green-400">
                  {buyUsdtConfirmed
                    ? "Purchase confirmed."
                    : "Approval confirmed."}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Transaction status */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
          <h3 className="text-base font-medium mb-2">Transaction status</h3>
          <div className="space-y-2 text-xs">
            {/* BNB status */}
            <div>
              <div className="text-white/60">BNB purchase</div>
              <div className="text-white/90">
                {isPendingBNB && !bnbHash ? (
                  <>Waiting for wallet…</>
                ) : bnbIsConfirming ? (
                  <>
                    Confirming on-chain…
                    {bnbHash && (
                      <a
                        className="underline text-yellow-400 ml-1"
                        href={`https://bscscan.com/tx/${bnbHash}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View
                      </a>
                    )}
                  </>
                ) : bnbIsConfirmed ? (
                  <>
                    Confirmed
                    {bnbHash && (
                      <a
                        className="underline text-yellow-400 ml-1"
                        href={`https://bscscan.com/tx/${bnbHash}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View
                      </a>
                    )}
                  </>
                ) : bnbHash ? (
                  <>
                    Submitted
                    {bnbHash && (
                      <a
                        className="underline text-yellow-400 ml-1"
                        href={`https://bscscan.com/tx/${bnbHash}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View
                      </a>
                    )}
                  </>
                ) : (
                  <>Idle</>
                )}
              </div>
            </div>
            {/* USDT approval status */}
            <div>
              <div className="text-white/60">USDT approval</div>
              <div className="text-white/90">
                {isPendingUSDT && !approveHash && !buyUsdtHash ? (
                  <>Waiting for wallet…</>
                ) : approveHash ? (
                  approveConfirming ? (
                    <>
                      Confirming…
                      <a
                        className="underline text-yellow-400 ml-1"
                        href={`https://bscscan.com/tx/${approveHash}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View
                      </a>
                    </>
                  ) : approveConfirmed ? (
                    <>
                      Confirmed
                      <a
                        className="underline text-yellow-400 ml-1"
                        href={`https://bscscan.com/tx/${approveHash}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View
                      </a>
                    </>
                  ) : (
                    <>
                      Submitted
                      <a
                        className="underline text-yellow-400 ml-1"
                        href={`https://bscscan.com/tx/${approveHash}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View
                      </a>
                    </>
                  )
                ) : (
                  <>Idle</>
                )}
              </div>
            </div>
            {/* USDT purchase status */}
            <div>
              <div className="text-white/60">USDT purchase</div>
              <div className="text-white/90">
                {buyUsdtHash ? (
                  buyUsdtConfirming ? (
                    <>
                      Confirming…
                      <a
                        className="underline text-yellow-400 ml-1"
                        href={`https://bscscan.com/tx/${buyUsdtHash}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View
                      </a>
                    </>
                  ) : buyUsdtConfirmed ? (
                    <>
                      Confirmed
                      <a
                        className="underline text-yellow-400 ml-1"
                        href={`https://bscscan.com/tx/${buyUsdtHash}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View
                      </a>
                    </>
                  ) : (
                    <>
                      Submitted
                      <a
                        className="underline text-yellow-400 ml-1"
                        href={`https://bscscan.com/tx/${buyUsdtHash}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View
                      </a>
                    </>
                  )
                ) : (
                  <>Idle</>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Recent transactions */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-medium">Recent transactions</h2>
            <span className="text-xs text-white/60">{recentTxs.length}</span>
          </div>
          <div className="mt-3 divide-y divide-white/10 text-sm">
            {recentTxs.length === 0 ? (
              <div className="text-white/70">No transactions yet.</div>
            ) : (
              recentTxs.map(tx => (
                <div key={tx.id} className="py-2 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{tx.type}</div>
                    <div className="text-white/60">
                      {tx.inputCurrency ?? ""} {tx.inputAmount ?? ""} → {TOKEN_SYMBOL} ~{tx.cxgExpected ?? ""}
                    </div>
                  </div>
                  <a
                    href={`https://bscscan.com/tx/${tx.hash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-yellow-400 hover:underline"
                  >
                    View
                  </a>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Last success */}
        {lastSuccess && (
          <div className="mt-4 rounded-2xl border border-green-700/40 bg-green-900/20 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-green-300">Last successful transaction</h3>
              <a
                href={`https://bscscan.com/tx/${lastSuccess.tx.hash}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-green-300 underline"
              >
                View
              </a>
            </div>
            <div className="mt-2 text-xs text-white/80">
              <div>Type: {lastSuccess.tx.type}</div>
              <div>Input: {lastSuccess.tx.inputCurrency} {lastSuccess.tx.inputAmount}</div>
              <div>Expected {TOKEN_SYMBOL}: {lastSuccess.tx.cxgExpected}</div>
              {lastSuccess.meta?.blockNumber && <div>Block: {lastSuccess.meta.blockNumber}</div>}
              {lastSuccess.meta?.gasUsed && <div>Gas used: {lastSuccess.meta.gasUsed}</div>}
            </div>
          </div>
        )}

        {/* Quick links */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Link href="/burn" className="rounded-2xl border border-white/10 bg-white/5 p-6 hover:bg-white/10">
            <div className="text-lg font-medium">Burn {TOKEN_SYMBOL}</div>
            <div className="mt-1 text-sm text-white/70">Use BNB or USDT to burn {TOKEN_SYMBOL}.</div>
          </Link>
          <Link href="/staking" className="rounded-2xl border border-white/10 bg-white/5 p-6 hover:bg-white/10">
            <div className="text-lg font-medium">Staking</div>
            <div className="mt-1 text-sm text-white/70">Stake your {TOKEN_SYMBOL} to earn rewards.</div>
          </Link>
          <a
            href={`https://pancakeswap.finance/swap?outputCurrency=BNB&inputCurrency=${CXG}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border border-white/10 bg-white/5 p-6 hover:bg-white/10"
          >
            <div className="text-lg font-medium">Swap on PancakeSwap</div>
            <div className="mt-1 text-sm text-white/70">Swap {TOKEN_SYMBOL} ↔ BNB on PancakeSwap.</div>
          </a>
        </div>

        {/* Back link */}
        <div className="mt-6 text-sm text-white/70">
          <Link href="/" className="hover:underline">← Back to home</Link>
        </div>
      </div>
    </div>
  );
}
export default function ClientArea() {
  return (
    <Providers>
      <ClientContent />
    </Providers>
  );
}
