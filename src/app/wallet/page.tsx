"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId, useSwitchChain } from "wagmi";
import { useEffect, useMemo, useState } from "react";
import { formatUnits, parseEther, parseUnits, formatEther, isAddress } from "viem";
import Providers from "@/components/providers";
import toast from "react-hot-toast";

const USDT = "0x55d398326f99059fF775485246999027B3197955" as `0x${string}`; // BSC USDT (18d)
const CXG = ((process.env.NEXT_PUBLIC_CXG_TOKEN_ADDRESS as `0x${string}` | undefined) ||
  "0xA63F08a32639689DfF7b89FC5C12fF89dC687B34") as `0x${string}`;

const SALE = (process.env.NEXT_PUBLIC_SALE_ADDRESS as `0x${string}` | undefined) ||
  ("0x02b0364a53f2D82d8EcBB4ccF058A44784f0dc3c" as `0x${string}`);

// Minimal ABIs
const saleAbi = [
  { type: "function", name: "buyWithBNB", inputs: [{ name: "sponsor", type: "address" }], outputs: [], stateMutability: "payable" },
  { type: "function", name: "buyWithUSDT", inputs: [{ name: "usdtAmount", type: "uint256" }, { name: "sponsor", type: "address" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "quoteTokensForBNB", inputs: [{ name: "wei", type: "uint256" }], outputs: [{ name: "tokensGross", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "quoteTokensForUSDT", inputs: [{ name: "usdtAmount", type: "uint256" }], outputs: [{ name: "tokensGross", type: "uint256" }], stateMutability: "view" },
] as const;

const erc20Abi = [
  { type: "function", name: "decimals", inputs: [], outputs: [{ type: "uint8" }], stateMutability: "view" },
  { type: "function", name: "approve", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
  { type: "function", name: "transfer", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
] as const;

function fmtFixed(valueStr: string, decimals: number) {
  const [i, f = ""] = valueStr.split(".");
  const int = (i || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = (f + "0".repeat(decimals)).slice(0, decimals);
  return `${int}.${frac}`;
}

// Safe error extractor (avoids using any)
type MsgErrorShape = { shortMessage?: string; details?: string; message?: string };
function errMsg(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const e = err as MsgErrorShape;
    return e.shortMessage || e.details || e.message || "Transaction failed";
  }
  return "Transaction failed";
}

function WalletContent() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: switching } = useSwitchChain();
  const onSwitchToBsc = () => switchChain?.({ chainId: 56 });

  // Readable precision toggle
  const [dp, setDp] = useState<4 | 8>(4);
  // Live balances
  const { data: bnbBal } = useBalance({ address, chainId: 56, query: { enabled: !!address } });
  const { data: usdtBal } = useBalance({ address, token: USDT, chainId: 56, query: { enabled: !!address } });
  const { data: cxgBal } = useBalance({ address, token: CXG, chainId: 56, query: { enabled: !!address && !!CXG } });

  const bnb = useMemo(() => (bnbBal ? fmtFixed(formatUnits(bnbBal.value, bnbBal.decimals), dp) : "—"), [bnbBal, dp]);
  const usdt = useMemo(() => (usdtBal ? fmtFixed(formatUnits(usdtBal.value, usdtBal.decimals), dp) : "—"), [usdtBal, dp]);
  const cxg = useMemo(() => (cxgBal ? fmtFixed(formatUnits(cxgBal.value, cxgBal.decimals), dp) : (CXG ? "—" : "Set NEXT_PUBLIC_CXG_TOKEN_ADDRESS")), [cxgBal, dp]);

  const wcConfigured = !!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID && process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID !== "demo";

  // Admin gating for shortcuts (comma-separated addresses in env)
  const isAdmin = useMemo(() => {
    const raw = (process.env.NEXT_PUBLIC_ADMIN_WALLETS || "").toLowerCase();
    if (!raw) return false;
    const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
    return address ? list.includes(address.toLowerCase()) : false;
  }, [address]);

  // ============ Buy with BNB ==========
  const ZERO = 0n;
  const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as const;
  // Optional sponsor (referral) input (after ZERO_ADDR)
  const [sponsor, setSponsor] = useState("");
  const sponsorAddr = useMemo(() => (sponsor && isAddress(sponsor) ? sponsor : ZERO_ADDR) as `0x${string}` , [sponsor, ZERO_ADDR]);
  const [bnbIn, setBnbIn] = useState("");
  const bnbWei = useMemo(() => { try { return parseEther(bnbIn || "0"); } catch { return ZERO; } }, [bnbIn, ZERO]);
  const bnbQuote = useReadContract({ address: SALE, abi: saleAbi, functionName: "quoteTokensForBNB", args: [bnbWei], query: { enabled: bnbWei > ZERO } }) as { data?: bigint };
  const bnbTokens = bnbQuote.data ?? ZERO;
  const { writeContractAsync: writeAsync, isPending: pendingWrite } = useWriteContract();
  const txHref = (h?: `0x${string}`) => (h ? `https://bscscan.com/tx/${h}` : "#");
  const [bnbHash, setBnbHash] = useState<`0x${string}` | undefined>(undefined);
  const { isLoading: bnbConfirming, isSuccess: bnbConfirmed } = useWaitForTransactionReceipt({ hash: bnbHash });
  const [bnbErr, setBnbErr] = useState<string | null>(null);
  async function onBuyBNB() {
    if (!address || bnbWei <= ZERO) return;
    try {
      setBnbErr(null);
      const h = await writeAsync({ address: SALE, abi: saleAbi, functionName: "buyWithBNB", args: [sponsorAddr], value: bnbWei });
      setBnbHash(h);
      toast.success(
        <span>
          BNB buy submitted · <a className="underline" href={txHref(h)} target="_blank" rel="noreferrer">View</a>
        </span>,
        { id: "bnb-sub" }
      );
    } catch (e: unknown) {
      const m = errMsg(e);
      setBnbErr(m);
      toast.error(m || "BNB buy failed", { id: "bnb-err" });
    }
  }
  useEffect(() => {
    if (bnbHash && bnbConfirmed) {
      toast.success(
        <span>
          BNB buy confirmed · <a className="underline" href={txHref(bnbHash)} target="_blank" rel="noreferrer">View</a>
        </span>,
        { id: "bnb-ok" }
      );
    }
  }, [bnbHash, bnbConfirmed]);

  // ============ Buy with USDT ==========
  const [usdtIn, setUsdtIn] = useState("");
  const usdtAmt = useMemo(() => { try { return parseUnits(usdtIn || "0", 18); } catch { return ZERO; } }, [usdtIn, ZERO]);
  const usdtQuote = useReadContract({ address: SALE, abi: saleAbi, functionName: "quoteTokensForUSDT", args: [usdtAmt], query: { enabled: usdtAmt > ZERO } }) as { data?: bigint };
  const usdtTokens = usdtQuote.data ?? ZERO;
  const [approveHash, setApproveHash] = useState<`0x${string}` | undefined>(undefined);
  const { isSuccess: approveConfirmed, isLoading: approveConfirming } = useWaitForTransactionReceipt({ hash: approveHash });
  const [buyHash, setBuyHash] = useState<`0x${string}` | undefined>(undefined);
  const { isLoading: buyConfirming, isSuccess: buyConfirmed } = useWaitForTransactionReceipt({ hash: buyHash });
  const [usdtErr, setUsdtErr] = useState<string | null>(null);
  useEffect(() => {
    // after approval confirmed, send buy
    (async () => {
      if (!approveConfirmed || !address || usdtAmt <= ZERO) return;
      try {
        const h2 = await writeAsync({ address: SALE, abi: saleAbi, functionName: "buyWithUSDT", args: [usdtAmt, sponsorAddr] });
        setBuyHash(h2);
        toast.success(
          <span>
            USDT buy submitted · <a className="underline" href={txHref(h2)} target="_blank" rel="noreferrer">View</a>
          </span>,
          { id: "usdt-buy-sub" }
        );
      } catch (e: unknown) {
        const m = errMsg(e);
        setUsdtErr(m);
        toast.error(m || "USDT buy failed", { id: "usdt-buy-err" });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveConfirmed]);
  useEffect(() => {
    if (approveHash && approveConfirmed) {
      toast.success(
        <span>
          USDT approved · <a className="underline" href={txHref(approveHash)} target="_blank" rel="noreferrer">View</a>
        </span>,
        { id: "usdt-approve-ok" }
      );
    }
  }, [approveHash, approveConfirmed]);
  useEffect(() => {
    if (buyHash && buyConfirmed) {
      toast.success(
        <span>
          USDT buy confirmed · <a className="underline" href={txHref(buyHash)} target="_blank" rel="noreferrer">View</a>
        </span>,
        { id: "usdt-buy-ok" }
      );
    }
  }, [buyHash, buyConfirmed]);
  async function onBuyUSDT() {
    if (!address || usdtAmt <= ZERO) return;
    try {
      setUsdtErr(null);
      const h1 = await writeAsync({ address: USDT, abi: erc20Abi, functionName: "approve", args: [SALE, usdtAmt] });
      setApproveHash(h1);
      toast(
        <span>
          Approval submitted · <a className="underline" href={txHref(h1)} target="_blank" rel="noreferrer">View</a>
        </span>,
        { id: "usdt-approve-sub" }
      );
    } catch (e: unknown) {
      const m = errMsg(e);
      setUsdtErr(m);
      toast.error(m || "Approval failed", { id: "usdt-approve-err" });
    }
  }

  // ============ Burn CXGP ==========
  const DEAD = "0x000000000000000000000000000000000000dEaD" as const;
  const [burnIn, setBurnIn] = useState("");
  // fetch CXG decimals
  const { data: cxgDecimalsRaw } = useReadContract({ address: CXG, abi: erc20Abi, functionName: "decimals", chainId: 56, query: { enabled: !!CXG } });
  const cxgDecimals = typeof cxgDecimalsRaw === "number" ? cxgDecimalsRaw : (cxgDecimalsRaw ? Number(cxgDecimalsRaw as unknown as bigint) : 18);
  const burnAmt = useMemo(() => { try { return parseUnits(burnIn || "0", cxgDecimals); } catch { return ZERO; } }, [burnIn, cxgDecimals, ZERO]);
  const [burnHash, setBurnHash] = useState<`0x${string}` | undefined>(undefined);
  const { isLoading: burnConfirming, isSuccess: burnConfirmed } = useWaitForTransactionReceipt({ hash: burnHash });
  const [burnErr, setBurnErr] = useState<string | null>(null);
  const onBurn = async () => {
    if (!address || burnAmt <= ZERO) return;
    try {
      setBurnErr(null);
      const h = await writeAsync({ address: CXG, abi: erc20Abi, functionName: "transfer", args: [DEAD, burnAmt] });
      setBurnHash(h);
      toast.success(
        <span>
          Burn submitted · <a className="underline" href={txHref(h)} target="_blank" rel="noreferrer">View</a>
        </span>,
        { id: "burn-sub" }
      );
    } catch (e: unknown) {
      const m = errMsg(e);
      setBurnErr(m);
      toast.error(m || "Burn failed", { id: "burn-err" });
    }
  };
  useEffect(() => {
    if (burnHash && burnConfirmed) {
      toast.success(
        <span>
          Burn confirmed · <a className="underline" href={txHref(burnHash)} target="_blank" rel="noreferrer">View</a>
        </span>,
        { id: "burn-ok" }
      );
    }
  }, [burnHash, burnConfirmed]);

  return (
  <div className="wallet min-h-dvh px-4 py-3 sm:px-6">
      <div className="mx-auto w-full max-w-5xl overflow-x-hidden">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <ConnectButton.Custom>
            {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
              const ready = mounted;
              const connected = ready && account && chain;
              const short = (addr?: string) => addr ? `${addr.slice(0,6)}…${addr.slice(-4)}` : "Wallet";
              return (
                <div className="flex items-center justify-end">
                  {!connected ? (
                    <button
                      onClick={openConnectModal}
                      className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-yellow-500 to-amber-600 px-3 py-1.5 text-sm font-semibold text-black shadow hover:from-yellow-400 hover:to-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/60"
                    >
                      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4">
                        <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a1 1 0 0 1 1 1v2H6A3 3 0 0 0 3 11v-3.5Z" fill="currentColor" opacity=".35"/>
                        <rect x="3" y="8" width="18" height="11" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M16 12.75h3a1.25 1.25 0 0 1 0 2.5h-3V12.75Z" fill="currentColor"/>
                      </svg>
                      Connect Wallet
                    </button>
                  ) : chain?.id !== 56 ? (
                    <button
                      onClick={openChainModal}
                      className="inline-flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-200 hover:bg-rose-500/15 focus:outline-none focus:ring-2 focus:ring-rose-500/40"
                    >
                      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4">
                        <path d="M12 3v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                        <path d="M7 6a7 7 0 1 0 10 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                      </svg>
                      Wrong network · Switch to BSC
                    </button>
                  ) : (
                    <button
                      onClick={openAccountModal}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-sm text-white/90 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-yellow-500/40"
                    >
                      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-400">
                        <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a1 1 0 0 1 1 1v2H6A3 3 0 0 0 3 11v-3.5Z" fill="currentColor" opacity=".35"/>
                        <rect x="3" y="8" width="18" height="11" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M16 12.75h3a1.25 1.25 0 0 1 0 2.5h-3V12.75Z" fill="currentColor"/>
                      </svg>
                      {short(account?.address)}
                      <span className="ml-1 hidden sm:inline text-white/60">· BNB {bnb}</span>
                    </button>
                  )}
                </div>
              );
            }}
          </ConnectButton.Custom>
        </div>

        {/* Network guard */}
        {isConnected && chainId !== 56 && (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200 flex items-center justify-between gap-3 min-w-0">
            <div className="break-words">You&apos;re on the wrong network. Please switch to BNB Smart Chain (BSC, Chain ID 56).</div>
            <button onClick={onSwitchToBsc} disabled={switching} className="rounded-md bg-white/15 px-3 py-1.5 text-white hover:bg-white/20 disabled:opacity-60">{switching ? "Switching…" : "Switch to BSC"}</button>
          </div>
        )}

        {/* WalletConnect hint for mobile */}
  {!wcConfigured && (
      <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 break-words">
    Tip: For mobile Safari/Chrome, choose WalletConnect and tap &quot;Open&quot; when prompted, or open this site inside your wallet app browser (MetaMask/Trust/TokenPocket).
      </div>
    )}

        {/* Balances */}
  <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-medium sm:text-lg">Balance</h2>
            <div className="inline-flex items-center rounded-md border border-white/10 bg-white/5 p-0.5 text-[11px] sm:text-xs">
              {[8,4].map(n => (
                <button key={n} onClick={() => setDp(n as 4 | 8)} className={`px-2 py-1 rounded ${dp===n ? 'bg-white/15 text-white' : 'text-white/70'}`}>{n} dp</button>
              ))}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:mt-4 sm:gap-4">
            {[{ label: "BNB", value: bnb }, { label: "USDT", value: usdt }, { label: "CXGP", value: cxg }].map((x) => (
        <div key={x.label} className="rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4 aspect-[5/3] sm:aspect-auto">
                <div className="text-[11px] text-white/60 sm:text-xs">{x.label}</div>
        <div className="mt-1 font-mono tabular-nums text-[13px] leading-tight text-white/90 sm:text-lg truncate">
                  {x.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Buy with BNB */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between min-w-0">
              <h3 className="text-base font-medium">Buy with BNB</h3>
              {bnbTokens > 0n && (
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70 truncate max-w-[55%]">~{Number(formatEther(bnbTokens)).toLocaleString()} CXGP</span>
              )}
            </div>
            <p className="mt-1 text-sm text-white/60">Use your BNB to purchase CXGP.</p>
            <div className="mt-3 flex items-center gap-2">
              <input value={bnbIn} onChange={(e) => setBnbIn(e.target.value)} placeholder="0.1" aria-label="BNB amount" className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-base sm:text-sm outline-none" />
              <button onClick={onBuyBNB} disabled={!isConnected || chainId !== 56 || bnbWei <= 0n || pendingWrite || bnbConfirming} className="rounded-lg bg-gradient-to-r from-yellow-500 to-amber-600 px-2.5 py-1.5 text-sm font-medium text-black disabled:opacity-60">{bnbConfirming ? "Confirming…" : pendingWrite ? "Process.." : "Buy"}</button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {[25,50,75,100].map(p => (
                <button key={p} onClick={() => {
                  if (!bnbBal) return; const v = (bnbBal.value * BigInt(p)) / 100n; setBnbIn(Number(formatEther(v)).toString());
                }} className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-white/80">{p}%</button>
              ))}
              <div className="ml-auto text-white/50">Bal: {bnb}</div>
            </div>
            {bnbErr && <div className="mt-2 text-xs text-red-400 break-all">{bnbErr}</div>}
            {bnbHash && (
              <div className="mt-2 text-xs text-white/70 break-all">
                Tx: <a className="underline text-yellow-300" href={`https://bscscan.com/tx/${bnbHash}`} target="_blank" rel="noreferrer">View</a>
              </div>
            )}
          </div>

          {/* Buy with USDT */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between min-w-0">
              <h3 className="text-base font-medium">Buy with USDT</h3>
              {usdtTokens > 0n && (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70">~{Number(formatEther(usdtTokens)).toLocaleString()} CXGP</span>
              )}
            </div>
            <p className="mt-1 text-sm text-white/60">Approve and buy with USDT.</p>
            <div className="mt-3 flex items-center gap-2">
              <input value={usdtIn} onChange={(e) => setUsdtIn(e.target.value)} placeholder="100" aria-label="USDT amount" className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-base sm:text-sm outline-none" />
              <button
                onClick={async () => {
                  if (!isConnected || chainId !== 56 || usdtAmt <= 0n) return;
                  if (approveConfirmed) {
                    try {
                      setUsdtErr(null);
                      const h2 = await writeAsync({ address: SALE, abi: saleAbi, functionName: "buyWithUSDT", args: [usdtAmt, sponsorAddr] });
                      setBuyHash(h2);
                    } catch (e: unknown) {
                      setUsdtErr(errMsg(e));
                    }
                  } else {
                    onBuyUSDT();
                  }
                }}
                disabled={
                  !isConnected ||
                  chainId !== 56 ||
                  usdtAmt <= 0n ||
                  pendingWrite ||
                  approveConfirming ||
                  buyConfirming
                }
                className="rounded-lg bg-gradient-to-r from-yellow-500 to-amber-600 px-2.5 py-1.5 text-sm font-medium text-black disabled:opacity-60"
              >
                {approveConfirming
                  ? "Approving…"
                  : pendingWrite
                  ? "Process.."
                  : buyConfirming
                  ? "Buying…"
                  : approveConfirmed
                  ? "Buy"
                  : "Approve"}
              </button>
            </div>
            <div className="mt-2 text-[11px] text-white/60">Step 1: Approve USDT · Step 2: Auto-buy CXGP</div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {[25,50,75,100].map(p => (
                <button key={p} onClick={() => {
                  if (!usdtBal) return; const v = (usdtBal.value * BigInt(p)) / 100n; setUsdtIn(Number(formatUnits(v, usdtBal.decimals)).toString());
                }} className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-white/80">{p}%</button>
              ))}
              <div className="ml-auto text-white/50">Bal: {usdt}</div>
            </div>
            {bnbBal && bnbBal.value === 0n && (
              <div className="mt-2 text-xs text-red-400">You need a little BNB for gas to approve and buy.</div>
            )}
            {usdtErr && <div className="mt-2 text-xs text-red-400 break-all">{usdtErr}</div>}
            {(approveHash || buyHash) && (
              <div className="mt-2 text-xs text-white/70 space-x-3 break-all">
                {approveHash && (
                  <span>Approve: <a className="underline text-yellow-300" href={`https://bscscan.com/tx/${approveHash}`} target="_blank" rel="noreferrer">View</a></span>
                )}
                {buyHash && (
                  <span>Buy: <a className="underline text-yellow-300" href={`https://bscscan.com/tx/${buyHash}`} target="_blank" rel="noreferrer">View</a></span>
                )}
              </div>
            )}
          </div>

          {/* Burn */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between min-w-0">
              <h3 className="text-base font-medium">Burn Tokens</h3>
              <span
                className="relative group rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70 cursor-help"
              >
                Irreversible ?
        <span className="absolute left-1/2 top-full z-10 mt-2 w-[min(16rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg bg-black/90 px-3 py-2 text-xs text-white opacity-0 group-hover:opacity-100 transition pointer-events-none">
                  Burning CXGP permanently destroys your tokens. This action cannot be undone and reduces the total supply. Use only if you want to remove tokens from circulation forever.
                </span>
              </span>
            </div>
            <p className="mt-1 text-sm text-white/60">Burn to permanently destroy.</p>
            <div className="mt-3 flex items-center gap-2">
              <input value={burnIn} onChange={(e) => setBurnIn(e.target.value)} placeholder="0.0" aria-label="CXGP amount to burn" className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-base sm:text-sm outline-none" />
              <button onClick={onBurn} disabled={!isConnected || chainId !== 56 || burnAmt <= 0n || pendingWrite || burnConfirming} className="rounded-lg bg-gradient-to-r from-rose-500 to-red-600 px-2.5 py-1.5 text-sm font-medium text-white disabled:opacity-60">{burnConfirming ? "Confirming…" : pendingWrite ? "Process.." : "Burn"}</button>
            </div>
            <div className="mt-2 text-xs text-white/50">Bal: {cxg}</div>
            {burnErr && <div className="mt-2 text-xs text-red-400 break-all">{burnErr}</div>}
            {burnHash && (
              <div className="mt-2 text-xs text-white/70 break-all">
                Tx: <a className="underline text-yellow-300" href={`https://bscscan.com/tx/${burnHash}`} target="_blank" rel="noreferrer">View</a>
              </div>
            )}
          </div>
        </div>

        {/* Sponsor input */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-base font-medium">Optional Sponsor</h3>
          <p className="mt-1 text-xs text-white/60">Enter your upline address to share referral rewards. Leave blank for none.</p>
          <input value={sponsor} onChange={(e) => setSponsor(e.target.value.trim())} placeholder="0xSponsorAddress (optional)" className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none" />
          {sponsor && !isAddress(sponsor) && (
            <div className="mt-1 text-xs text-rose-400">Invalid address; using no sponsor.</div>
          )}
          {sponsor && isAddress(sponsor) && (
            <div className="mt-1 text-xs text-emerald-400">Valid sponsor captured.</div>
          )}
        </div>

        {/* Shortcuts (admin only) */}
        {isAdmin && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
            <h3 className="text-base font-medium">Shortcuts</h3>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <Link href="/client" className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 hover:bg-white/10">Client (Full Buy)</Link>
              <Link href="/burn" className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 hover:bg-white/10">Burn</Link>
              <a
                href={`https://pancakeswap.finance/swap?outputCurrency=BNB&inputCurrency=${CXG}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 hover:bg-white/10"
              >Swap on PancakeSwap</a>
            </div>
          </div>
        )}

        {/* Back link */}
        <div className="mt-6 text-sm text-white/70">
          <Link href="/" className="hover:underline">← Back to home</Link>
        </div>
      </div>
    </div>
  );
}

export default function WalletPage() {
  return (
    <Providers>
      <WalletContent />
    </Providers>
  );
}
