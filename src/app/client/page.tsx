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
const TOKEN_SYMBOL = (process.env.NEXT_PUBLIC_TOKEN_SYMBOL || "CXG+").trim();
const TOKEN_NAME = (process.env.NEXT_PUBLIC_TOKEN_NAME || "Token for Gold").trim();
const SALE = (process.env.NEXT_PUBLIC_SALE_ADDRESS as `0x${string}` | undefined) || "0x02b0364a53f2D82d8EcBB4ccF058A44784f0dc3c" as const;
const USDT = "0x55d398326f99059fF775485246999027B3197955" as `0x${string}`; // 18 decimals on BSC
const CXG = (process.env.NEXT_PUBLIC_CXG_TOKEN_ADDRESS as `0x${string}` | undefined);

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

// Lightweight SVG line chart using GeckoTerminal OHLCV API (no extra deps)
// Docs example endpoint (public):
// https://api.geckoterminal.com/api/v2/networks/bsc/pools/<POOL_ADDRESS>/ohlcv/1h?aggregate=1&limit=72
function GeckoOhlcvChart({
  pool,
  network = "bsc",
  interval = "1h",
  limit = 72,
  height = 160,
}: {
  pool: string;
  network?: string;
  interval?: "5m" | "15m" | "1h" | "4h" | "1d";
  limit?: number;
  height?: number;
}) {
  const [points, setPoints] = useState<Array<{ t: number; c: number }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const url = `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${pool}/ohlcv/${interval}?aggregate=1&limit=${limit}`;
        const res = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        // Prefer attributes.ohlcv_list if present; fallback to attributes.ohlcv
        type OhlcvRow = [number, number, number, number, number, number];
        const raw = json?.data?.attributes?.ohlcv_list ?? json?.data?.attributes?.ohlcv ?? [];
        const list = (Array.isArray(raw) ? raw : []) as unknown as OhlcvRow[];
        const mapped = list
          .map((row) => ({ t: Number(row[0]) * 1000, c: Number(row[4]) })) // [ts, o, h, l, c, v]
          .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.c));
        setPoints(mapped);
      } catch (e) {
        if (e && typeof e === "object" && (e as { name?: string }).name === "AbortError") return;
        setError(extractErrMsg(e));
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => ctrl.abort();
  }, [network, pool, interval, limit]);

  if (loading) {
    return <div className="mt-4 text-sm text-white/70">Loading chart…</div>;
  }
  if (error || points.length < 2) {
    return (
      <div className="mt-4 text-sm text-white/70">
        Chart data unavailable right now.
      </div>
    );
  }

  // Build responsive SVG path
  const W = 600; // viewBox width; actual rendered width will be 100%
  const H = height;
  const closes = points.map((p) => p.c);
  let min = Math.min(...closes);
  let max = Math.max(...closes);
  if (min === max) {
    // Avoid divide by zero; add small epsilon
    const eps = min === 0 ? 1 : min * 0.01;
    min -= eps;
    max += eps;
  }
  const n = points.length;
  const toXY = (i: number) => {
    const x = (i / (n - 1)) * W;
    const y = H - ((points[i].c - min) / (max - min)) * H;
    return [x, y] as const;
  };
  let d = "";
  for (let i = 0; i < n; i++) {
    const [x, y] = toXY(i);
    d += (i === 0 ? "M" : " L") + x.toFixed(2) + " " + y.toFixed(2);
  }
  const last = closes[closes.length - 1];
  const first = closes[0];
  const pct = ((last - first) / first) * 100;

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center gap-2 text-sm">
        <span className="text-white/80">Last:</span>
        <span className="font-medium">{last.toLocaleString()}</span>
        <span className={pct >= 0 ? "text-emerald-400" : "text-rose-400"}>
          ({pct >= 0 ? "+" : ""}{pct.toFixed(2)}%)
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Price chart">
        <defs>
          <linearGradient id="gt-stroke" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
        <path d={d} fill="none" stroke="url(#gt-stroke)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

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
  const { data: bnbBal } = useBalance({ address, query: { enabled: !!address } });
  const { data: usdtBal } = useBalance({ address, token: USDT, query: { enabled: !!address } });
  const { data: cxgBal } = useBalance({ address, token: CXG, query: { enabled: !!address && !!CXG } });

  const bnbBalanceWei = bnbBal?.value ?? 0n;
  const fmt4 = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  const bnbFormatted4 = useMemo(() => bnbBal ? fmt4(Number(formatUnits(bnbBal.value, bnbBal.decimals))) : "—", [bnbBal]);
  const usdtFormatted4 = useMemo(() => usdtBal ? fmt4(Number(formatUnits(usdtBal.value, usdtBal.decimals))) : "—", [usdtBal]);
  const cxgFormatted4 = useMemo(() => cxgBal ? fmt4(Number(formatUnits(cxgBal.value, cxgBal.decimals))) : (CXG ? "—" : "Set NEXT_PUBLIC_CXG_TOKEN_ADDRESS"), [cxgBal, CXG]);
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
  const { data: cxgSupplyWeiRaw } = useReadContract({
    address: CXG,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [SALE],
    query: { enabled: !!CXG },
  });
  const { data: cxgTotalSupplyRaw } = useReadContract({
    address: CXG,
    abi: erc20Abi,
    functionName: "totalSupply",
    query: { enabled: !!CXG },
  });
  // Prefer balanceOf(SALE) if token supply for sale is stored there; fallback to totalSupply
  const saleSupplyWei = ((cxgSupplyWeiRaw as bigint | undefined) ?? null);
  const totalSupplyWei = ((cxgTotalSupplyRaw as bigint | undefined) ?? null);
  // Use Sale Supply when > 0; if it's 0, fallback to Total Supply; if Sale is null, also fallback to Total
  const availableSupplyWei = (
    saleSupplyWei === null
      ? totalSupplyWei
      : (saleSupplyWei === 0n ? totalSupplyWei : saleSupplyWei)
  );

  // Quote per 1 BNB/USDT to derive max spend by supply
  const ONE = parseEther("1");
  const { data: cxgPer1BnbRaw } = useReadContract({
    address: SALE,
    abi: saleAbi,
    functionName: "quoteTokensForBNB",
    args: [ONE],
    query: { enabled: true },
  });
  const cxgPer1Bnb = (cxgPer1BnbRaw as bigint | undefined) ?? 0n;

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
  const bnbBuyGasCostPaddedWei = useMemo(() => bnbBuyGasCostWei ? (bnbBuyGasCostWei * (100n + GAS_PAD_PCT)) / 100n : null, [bnbBuyGasCostWei]);
  // const bnbGasLimitPadded = useMemo(() => bnbBuyGasUnits ? (bnbBuyGasUnits * (100n + GAS_PAD_PCT)) / 100n : null, [bnbBuyGasUnits, GAS_PAD_PCT]);

  // Enforce 80% cap for BNB spend
  const bnbCapWei = useMemo(() => (bnbBalanceWei * BNB_SPEND_CAP_PCT) / 100n, [bnbBalanceWei]);
  const bnbOverCap = bnbWei > 0n && bnbWei > bnbCapWei;

  // Enforce remaining supply cap for BNB path
  const bnbExceedsSupply = useMemo(() => (availableSupplyWei !== null && bnbNetTokens > 0n) ? bnbNetTokens > availableSupplyWei : false, [availableSupplyWei, bnbNetTokens]);
  const bnbMaxBySupplyWei = useMemo(() => {
    if (availableSupplyWei === null || cxgPer1Bnb === 0n) return null;
    // maxBNB = supply / (cxg per 1 BNB)
    return (availableSupplyWei * ONE) / cxgPer1Bnb;
  }, [availableSupplyWei, cxgPer1Bnb]);

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

  // Quote per 1 USDT
  const ONE_USDT = parseUnits("1", 18);
  const { data: cxgPer1UsdtRaw } = useReadContract({
    address: SALE,
    abi: saleAbi,
    functionName: "quoteTokensForUSDT",
    args: [ONE_USDT],
    query: { enabled: true },
  });
  const cxgPer1Usdt = (cxgPer1UsdtRaw as bigint | undefined) ?? 0n;
  const usdtExceedsSupply = useMemo(() => (availableSupplyWei !== null && usdtNetTokens > 0n) ? usdtNetTokens > availableSupplyWei : false, [availableSupplyWei, usdtNetTokens]);

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
  const usdtTotalGasCostPaddedWei = useMemo(() => usdtTotalGasCostWei ? (usdtTotalGasCostWei * (100n + GAS_PAD_PCT)) / 100n : null, [usdtTotalGasCostWei]);
  const hasEnoughBnbForUsdtGas = useMemo(() => (usdtTotalGasCostPaddedWei !== null) ? bnbBalanceWei >= usdtTotalGasCostPaddedWei : true, [bnbBalanceWei, usdtTotalGasCostPaddedWei]);
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
        const rows: Tx[] = snaps.docs.map(d => {
          const data = d.data() as Partial<Tx>;
          return { id: d.id, type: data.type ?? "", inputCurrency: data.inputCurrency, inputAmount: data.inputAmount, cxgExpected: data.cxgExpected, gross: (data as any).gross, r1: (data as any).r1, r2: (data as any).r2, r3: (data as any).r3, hash: (data.hash as string) ?? d.id };
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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">{isConnected ? "Connected" : "Client Area"}</h1>
          <ConnectButton />
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {/* Balances */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 md:col-span-2">
            <h2 className="text-lg font-medium">Balances</h2>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-4 text-sm">
              <div className="rounded-lg border border-white/10 p-3">
                <div className="text-white/60">BNB</div>
                <div className="text-white text-right">{bnbFormatted4}</div>
              </div>
              <div className="rounded-lg border border-white/10 p-3">
                <div className="text-white/60">USDT</div>
                <div className="text-white text-right">{usdtFormatted4}</div>
              </div>
              <div className="rounded-lg border border-white/10 p-3">
                <div className="text-white/60">{TOKEN_SYMBOL}</div>
                <div className="text-white text-right">{cxgFormatted4}</div>
              </div>
              <div className="rounded-lg border border-white/10 p-3">
                <div className="text-white/60">Supply</div>
                <div className="text-white text-right">{availableSupplyWei !== null ? fmt4(Number(formatEther(availableSupplyWei))) : "—"}</div>
              </div>
            </div>
          </div>
          {/* BNB Purchase */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-medium">Buy with BNB</h2>
            {/* <p className="mt-1 text-sm text-white/70">Masukkan jumlah BNB untuk dibelanjakan. Di hadkan ke 80% daripada baki. Baki supply: {availableSupplyWei !== null ? Number(formatEther(availableSupplyWei)).toLocaleString() : "—"} CXG.</p> */}
            <div className="mt-4 space-y-3">
              <input
                value={bnbIn}
                onChange={(e) => setBnbIn(e.target.value)}
                placeholder="0.1"
                className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 outline-none focus:ring-2 focus:ring-yellow-600"
              />
              <div className="flex items-center justify-between text-xs text-white/70">
                <div>
                  Maximum 80%: {bnbBal ? Number(formatEther(bnbCapWei)).toFixed(6) : "-"} BNB
                </div>
                <button
                  type="button"
                  onClick={() => setBnbIn(bnbBal ? Number(formatEther(bnbCapWei)).toFixed(6) : "")}
                  className="rounded bg-white/10 px-2 py-1 text-white hover:bg-white/20"
                >Max 80%</button>
              </div>
              {/* {bnbMaxBySupplyWei !== null && (
                <div className="flex items-center justify-between text-xs text-white/70">
                  <div>Max by supply: {Number(formatEther(bnbMaxBySupplyWei)).toFixed(6)} BNB</div>
                  <button type="button" onClick={() => setBnbIn(Number(formatEther(bnbMaxBySupplyWei!)).toFixed(6))} className="rounded bg-white/10 px-2 py-1 text-white hover:bg-white/20">Max by supply</button>
                </div>
              )} */}
              <div className="text-sm text-white/80">
                {bnbGrossTokens > 0n ? (
                  <>You will receive ~{Number(formatEther(bnbNetTokens)).toLocaleString()} {TOKEN_SYMBOL} (net)</>
                ) : (
                  <>—</>
                )}
              </div>
              {bnbOverCap && (
                <div className="text-xs text-red-400">Amount exceeds 80% of your BNB balance.</div>
              )}
              {bnbExceedsSupply && (
                <div className="text-xs text-red-400">Requested {TOKEN_SYMBOL} exceeds available supply.</div>
              )}
              {bnbBuyGasCostWei && (
                <div className="text-xs text-white/70">Estimated gas: ~{Number(formatEther(bnbBuyGasCostWei)).toFixed(6)} BNB {bnbBuyGasCostPaddedWei ? `(+${Number(GAS_PAD_PCT)}%: ${Number(formatEther(bnbBuyGasCostPaddedWei)).toFixed(6)} BNB)` : ''}. Consider keeping a minimum for gas.</div>
              )}
              <button
                onClick={handleBuyBNB}
                disabled={!isConnected || bnbWei <= 0n || isPendingBNB || bnbIsConfirming || bnbOverCap || bnbExceedsSupply}
                className="w-full rounded-lg bg-gradient-to-r from-yellow-500 to-amber-600 py-2.5 font-medium text-black disabled:opacity-60"
              >
                {bnbIsConfirming ? "Confirming…" : isPendingBNB ? "Waiting wallet…" : "Buy with BNB"}
              </button>
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
            {/* <p className="mt-1 text-sm text-white/70">Masukkan jumlah USDT untuk dibelanjakan. Pastikan baki BNB mencukupi untuk membayar gas. Baki supply: {availableSupplyWei !== null ? Number(formatEther(availableSupplyWei)).toLocaleString() : "—"} CXG.</p> */}
            <div className="mt-4 space-y-3">
              <input
                value={usdtIn}
                onChange={(e) => setUsdtIn(e.target.value)}
                placeholder="100"
                className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 outline-none focus:ring-2 focus:ring-yellow-600"
              />
              <div className="text-sm text-white/80">
                {usdtGrossTokens > 0n ? (
                  <>You will receive ~{Number(formatEther(usdtNetTokens)).toLocaleString()} {TOKEN_SYMBOL} (net)</>
                ) : (
                  <>—</>
                )}
              </div>
              {/* {usdtMaxBySupplyWei !== null && (
                <div className="flex items-center justify-between text-xs text-white/70">
                  <div>Max by supply: {Number(formatEther(usdtMaxBySupplyWei)).toFixed(6)} USDT</div>
                  <button type="button" onClick={() => setUsdtIn(Number(formatEther(usdtMaxBySupplyWei!)).toFixed(6))} className="rounded bg-white/10 px-2 py-1 text-white hover:bg-white/20">Max by supply</button>
                </div>
              )} */}
              {/* {usdtTotalGasCostWei && (
                <div className="text-xs text-white/70">Gas required (approve + buy): ~{Number(formatEther(usdtTotalGasCostWei)).toFixed(6)} BNB {usdtTotalGasCostPaddedWei ? `(+${Number(GAS_PAD_PCT)}%: ${Number(formatEther(usdtTotalGasCostPaddedWei)).toFixed(6)} BNB)` : ''}</div>
              )} */}
              {usdtExceedsSupply && (
                <div className="text-xs text-red-400">Requested {TOKEN_SYMBOL} exceeds available supply.</div>
              )}
              {!hasEnoughBnbForUsdtGas && (
                <div className="text-xs text-red-400">Insufficient BNB for gas. Add BNB or reduce the USDT amount.</div>
              )}
              <button
                onClick={handleBuyUSDT}
                disabled={!isConnected || usdtAmt <= 0n || isPendingUSDT || approveConfirming || buyUsdtConfirming || !hasEnoughBnbForUsdtGas || usdtExceedsSupply}
                className="w-full rounded-lg bg-gradient-to-r from-yellow-500 to-amber-600 py-2.5 font-medium text-black disabled:opacity-60"
              >
                {buyUsdtConfirming || approveConfirming ? "Confirming…" : isPendingUSDT ? "Waiting wallet…" : "Approve & Buy USDT"}
              </button>
              {usdtError && (
                <div className="text-xs text-red-400 break-all">{usdtError}</div>
              )}
              {(approveConfirmed || buyUsdtConfirmed) && (
                <div className="text-xs text-green-400">{buyUsdtConfirmed ? "Purchase confirmed." : "Approval confirmed."}</div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
          <h3 className="text-base font-medium mb-2">Transaction status</h3>
          <div className="space-y-2 text-xs">
            {/* BNB status */}
            <div>
              <div className="text-white/60">BNB purchase</div>
              <div className="text-white/90">
                {isPendingBNB && !bnbHash ? (
                  <>Waiting for wallet…</>
                ) : bnbIsConfirming ? (
                  <>Confirming on-chain… {bnbHash && (<a className="underline text-yellow-400 ml-1" href={`https://bscscan.com/tx/${bnbHash}`} target="_blank" rel="noreferrer">View</a>)}</>
                ) : bnbIsConfirmed ? (
                  <>Confirmed {bnbHash && (<a className="underline text-yellow-400 ml-1" href={`https://bscscan.com/tx/${bnbHash}`} target="_blank" rel="noreferrer">View</a>)}</>
                ) : bnbHash ? (
                  <>Submitted {bnbHash && (<a className="underline text-yellow-400 ml-1" href={`https://bscscan.com/tx/${bnbHash}`} target="_blank" rel="noreferrer">View</a>)}</>
                ) : (
                  <>Idle</>
                )}
              </div>
            </div>
            {/* USDT status */}
            <div>
              <div className="text-white/60">USDT approval</div>
              <div className="text-white/90">
                {isPendingUSDT && !approveHash && !buyUsdtHash ? (
                  <>Waiting for wallet…</>
                ) : approveHash ? (
                  approveConfirming ? (
                    <>Confirming… <a className="underline text-yellow-400 ml-1" href={`https://bscscan.com/tx/${approveHash}`} target="_blank" rel="noreferrer">View</a></>
                  ) : approveConfirmed ? (
                    <>Confirmed <a className="underline text-yellow-400 ml-1" href={`https://bscscan.com/tx/${approveHash}`} target="_blank" rel="noreferrer">View</a></>
                  ) : (
                    <>Submitted <a className="underline text-yellow-400 ml-1" href={`https://bscscan.com/tx/${approveHash}`} target="_blank" rel="noreferrer">View</a></>
                  )
                ) : (
                  <>Idle</>
                )}
              </div>
            </div>
            <div>
              <div className="text-white/60">USDT purchase</div>
              <div className="text-white/90">
                {buyUsdtHash ? (
                  buyUsdtConfirming ? (
                    <>Confirming… <a className="underline text-yellow-400 ml-1" href={`https://bscscan.com/tx/${buyUsdtHash}`} target="_blank" rel="noreferrer">View</a></>
                  ) : buyUsdtConfirmed ? (
                    <>Confirmed <a className="underline text-yellow-400 ml-1" href={`https://bscscan.com/tx/${buyUsdtHash}`} target="_blank" rel="noreferrer">View</a></>
                  ) : (
                    <>Submitted <a className="underline text-yellow-400 ml-1" href={`https://bscscan.com/tx/${buyUsdtHash}`} target="_blank" rel="noreferrer">View</a></>
                  )
                ) : (
                  <>Idle</>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Transactions */}
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
                    <div className="text-white/60">{tx.inputCurrency ?? ""} {tx.inputAmount ?? ""} → {TOKEN_SYMBOL} ~{tx.cxgExpected ?? ""}</div>
                  </div>
                  <a href={`https://bscscan.com/tx/${tx.hash}`} target="_blank" rel="noreferrer" className="text-yellow-400 hover:underline">View</a>
                </div>
              ))
            )}
          </div>
        </div>

        {lastSuccess && (
          <div className="mt-4 rounded-2xl border border-green-700/40 bg-green-900/20 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-green-300">Last successful transaction</h3>
              <a href={`https://bscscan.com/tx/${lastSuccess.tx.hash}`} target="_blank" rel="noreferrer" className="text-xs text-green-300 underline">View</a>
            </div>
            <div className="mt-2 text-xs text-white/80">
              <div>Type: {lastSuccess.tx.type}</div>
              <div>Input: {lastSuccess.tx.inputCurrency} {lastSuccess.tx.inputAmount}</div>
              <div>Expected {TOKEN_SYMBOL}: {lastSuccess.tx.cxgExpected}</div>
              {lastSuccess.meta?.blockNumber && (<div>Block: {lastSuccess.meta.blockNumber}</div>)}
              {lastSuccess.meta?.gasUsed && (<div>Gas used: {lastSuccess.meta.gasUsed}</div>)}
            </div>
          </div>
        )}

        {/* CXG+/BNB Chart (live via GeckoTerminal API) */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-base font-medium">{TOKEN_SYMBOL}/BNB Chart</h2>
          <GeckoOhlcvChart pool="0xcf63a6F26090E9807e49dBa79D764Ac48C88d597" interval="1h" limit={72} />
          <div className="mt-3 text-xs text-white/60">
            Pair:
            <a
              href="https://bscscan.com/address/0xcf63a6F26090E9807e49dBa79D764Ac48C88d597"
              target="_blank"
              rel="noreferrer"
              className="ml-1 underline text-yellow-400"
            >0xcf63a6F26090E9807e49dBa79D764Ac48C88d597</a>
            <span className="mx-1">•</span>
            <a
              href="https://pancakeswap.finance/info/v2/pairs/0xcf63a6F26090E9807e49dBa79D764Ac48C88d597"
              target="_blank"
              rel="noreferrer"
              className="underline text-yellow-400"
            >View on PancakeSwap</a>
            <span className="mx-1">•</span>
            <a
              href="https://www.geckoterminal.com/bsc/pools/0xcf63a6F26090E9807e49dBa79D764Ac48C88d597"
              target="_blank"
              rel="noreferrer"
              className="underline text-yellow-400"
            >GeckoTerminal</a>
          </div>
        </div>

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
            href="https://pancakeswap.finance/swap?outputCurrency=BNB&inputCurrency=0x23fD60a35ad878D4e74C8F4534d4Bd55bBcCD002"
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border border-white/10 bg-white/5 p-6 hover:bg-white/10"
          >
            <div className="text-lg font-medium">Swap on PancakeSwap</div>
            <div className="mt-1 text-sm text-white/70">Swap {TOKEN_SYMBOL} ↔ BNB on PancakeSwap.</div>
          </a>
        </div>

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
