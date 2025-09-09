import Link from "next/link";
import GeckoChartTile from "@/components/GeckoChartTile";
import BNBCandles from "@/components/bnb-candles";

export default function Home() {
  return (
  <div className="min-h-dvh text-white bg-[radial-gradient(1200px_600px_at_50%_-200px,rgba(212,175,55,0.08),transparent)]">

      <main>
        {/* Hero */}
        <section className="relative">
          <div className="mx-auto max-w-7xl px-6 pt-20 pb-16 md:pt-28 md:pb-24">
            <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-12">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80">
                  <span className="h-2 w-2 rounded-full bg-green-400" />
                  BNB Chain • Buy with BNB or USDT
                </div>
                <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
                  Blockchain Infrastructure for Enterprises
                </h1>
                <p className="mt-5 text-pretty text-base text-white/80 sm:text-lg">
                  Global leaders use the CXG+ platform to build their blockchain and stablecoin solutions —
                  powered by the CXG+ token for utility and governance.
                </p>
                {/* <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/client"
                    className="inline-flex items-center justify-center rounded-lg bg-white px-5 py-3 text-sm font-medium text-black hover:opacity-90"
                  >
                    Buy CXG
                  </Link>
                  <Link
                    href="#pricing"
                    className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-white hover:bg-white/10"
                  >
                    See live market
                  </Link>
                </div> */}
                <div className="mt-10 flex flex-wrap items-center gap-3 text-xs text-white/80">
                  {[
                    "Non‑custodial",
                    "Low fees",
                    "Instant settlement",
                  ].map((label) => (
                    <span key={label} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                      {label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="relative">
                <div className="relative rounded-2xl border border-white/10 bg-white/5 p-3 shadow-2xl shadow-black/40">
                  <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-black">
                    <div className="absolute inset-0 grid grid-cols-6 grid-rows-6 opacity-0">
                      {Array.from({ length: 36 }).map((_, i) => (
                        <div key={i} className="border border-white/10" />
                      ))}
                    </div>
                    <div className="absolute inset-0 p-4">
                      <BNBCandles className="h-full w-full" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="border-y border-white/10 bg-white/[0.02]">
          <div className="mx-auto max-w-7xl px-6 py-10 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {[
              { k: "5k+", v: "Customers" },
              { k: "120M", v: "API calls/day" },
              { k: "99.99%", v: "Uptime" },
              { k: "24/7", v: "Support" },
            ].map((s) => (
              <div key={s.v} className="">
                <div className="text-2xl font-semibold tracking-tight bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-300 bg-clip-text text-transparent">{s.k}</div>
                <div className="text-sm text-white/70">{s.v}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="solutions" className="mx-auto max-w-7xl px-6 py-16 md:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Meet the CXG+ Token</h2>
            <p className="mt-3 text-white/80">CXG+ powers the platform as a utility and governance token — used for fees, access to enterprise features, staking rewards, and on‑chain voting on BNB Chain.</p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Stablecoin issuance",
                desc: "Issue and manage asset‑backed stablecoins with mint, redeem, and treasury controls.",
                icon: (
                  <svg viewBox="0 0 24 24" className="h-5 w-5 text-yellow-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="7" />
                    <circle cx="12" cy="12" r="3.5" />
                  </svg>
                ),
              },
              {
                title: "On‑chain settlement",
                desc: "Move funds 24/7 with finality on BNB Chain. Cut costs vs. wires and SWIFT.",
                icon: (
                  <svg viewBox="0 0 24 24" className="h-5 w-5 text-yellow-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 7H4" />
                    <path d="M4 7l3-3" />
                    <path d="M4 7l3 3" />
                    <path d="M16 17h4" />
                    <path d="M20 17l-3-3" />
                    <path d="M20 17l-3 3" />
                  </svg>
                ),
              },
              {
                title: "Token utility",
                desc: "Stake CXG+ for protocol rewards and participate in governance decisions.",
                icon: (
                  <svg viewBox="0 0 24 24" className="h-5 w-5 text-yellow-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 4l2.5 4.9 5.4.8-3.9 3.8.9 5.4L12 16.6 7.1 19.9l.9-5.4L4.1 9.7l5.4-.8L12 4z" />
                  </svg>
                ),
              },
              {
                title: "Compliance & security",
                desc: "KYC‑ready workflows, audit trails, and multi‑sig safeguards built‑in.",
                icon: (
                  <svg viewBox="0 0 24 24" className="h-5 w-5 text-yellow-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3l7 3v6c0 4.97-3.05 9.27-7 10-3.95-.73-7-5.03-7-10V6l7-3z" />
                    <path d="M8.5 12.5l2.5 2.5 4.5-4.5" />
                  </svg>
                ),
              },
              {
                title: "Treasury & reporting",
                desc: "Real‑time balances, on‑chain statements, and exportable reports for finance teams.",
                icon: (
                  <svg viewBox="0 0 24 24" className="h-5 w-5 text-yellow-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 19h18" />
                    <path d="M6 19V11" />
                    <path d="M12 19V5" />
                    <path d="M18 19v-7" />
                  </svg>
                ),
              },
              {
                title: "24/7 support",
                desc: "Priority support and solution architects for enterprise rollouts.",
                icon: (
                  <svg viewBox="0 0 24 24" className="h-5 w-5 text-yellow-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="7" />
                    <path d="M12 9v4l2 1" />
                  </svg>
                ),
              },
            ].map((f) => (
              <div key={f.title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-white/10 ring-1 ring-white/10">
                    {f.icon}
                  </div>
                  <h3 className="text-base font-medium text-yellow-400">{f.title}</h3>
                </div>
                <p className="mt-3 text-sm text-white/80">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Testimonial */}
        <section className="mx-auto max-w-5xl px-6 pb-16 md:pb-24">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 p-8 md:p-12">
            <p className="text-pretty text-xl md:text-2xl leading-relaxed">
              “With CXG we went from pilot to production in weeks. We issue and settle 24/7 on BNB Chain,
              cut reconciliation time by 70%, and moved from T+2 to real‑time with built‑in audit trails.”
            </p>
            <div className="mt-6 flex items-center gap-3">
              <span className="inline-block h-10 w-10 rounded-full bg-gradient-to-br from-yellow-500 to-amber-700" />
              <div>
                <div className="text-sm font-medium">Nadia Rahman</div>
                <div className="text-xs text-white/70">Head of Digital Assets, Nusantara Bank</div>
              </div>
            </div>
          </div>
        </section>

  {/* Live Market */}
  {/** Dynamically import client-only chart to avoid SSR fetch to GeckoTerminal **/}
  {/** Using dynamic import so the rest of the page can still be pre-rendered **/}
        
        <section id="pricing" className="mx-auto max-w-7xl px-6 pb-16 md:pb-24">
          <div className="mx-auto max-w-2xl text-center mb-8">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Live Market</h2>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                key: "FX_IDC:MYRUSD",
                title: "MYR/USDT — Approx via USD",
                src: "https://www.tradingview-widget.com/embed-widget/mini-symbol-overview/?locale=en#%7B%22symbol%22%3A%22FX_IDC%3AMYRUSD%22%2C%22width%22%3A%22100%25%22%2C%22height%22%3A%22100%25%22%2C%22dateRange%22%3A%2212M%22%2C%22colorTheme%22%3A%22dark%22%2C%22isTransparent%22%3Atrue%2C%22autosize%22%3Atrue%2C%22largeChartUrl%22%3A%22%22%7D",
              },
              {
                key: "OANDA:XAUUSD",
                title: "XAU/USD — OANDA",
                src: "https://www.tradingview-widget.com/embed-widget/mini-symbol-overview/?locale=en#%7B%22symbol%22%3A%22OANDA%3AXAUUSD%22%2C%22width%22%3A%22100%25%22%2C%22height%22%3A%22100%25%22%2C%22dateRange%22%3A%2212M%22%2C%22colorTheme%22%3A%22dark%22%2C%22isTransparent%22%3Atrue%2C%22autosize%22%3Atrue%2C%22largeChartUrl%22%3A%22%22%7D",
              },
              {
                key: "BINANCE:BNBUSDT",
                title: "BNB/USDT — Binance",
                src: "https://www.tradingview-widget.com/embed-widget/mini-symbol-overview/?locale=en#%7B%22symbol%22%3A%22BINANCE%3ABNBUSDT%22%2C%22width%22%3A%22100%25%22%2C%22height%22%3A%22100%25%22%2C%22dateRange%22%3A%2212M%22%2C%22colorTheme%22%3A%22dark%22%2C%22isTransparent%22%3Atrue%2C%22autosize%22%3Atrue%2C%22largeChartUrl%22%3A%22%22%7D",
              },
              {
                key: "CXG/BNB",
                title: "CXG+/BNB — GeckoTerminal",
                src: "gecko", // sentinel to render custom chart
              },
            ].map((w) => (
              <div key={w.key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="h-56 md:h-64 lg:h-72 overflow-hidden rounded-xl ring-1 ring-white/10 bg-black/40">
          {w.src && w.src !== "gecko" ? (
                    <iframe
                      src={w.src}
                      title={w.title}
                      loading="lazy"
                      className="h-full w-full"
                      frameBorder={0}
                    />
                  ) : (
                    <div className="h-full w-full px-4 py-3">
            {/* Client-only chart */}
            <GeckoChartTile pool="0xcf63a6F26090E9807e49dBa79D764Ac48C88d597" interval="1h" limit={72} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-6 pb-20 md:pb-28">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-yellow-500/10 via-amber-600/10 to-yellow-500/10 p-8 md:p-12 text-center">
            <h3 className="text-2xl font-semibold tracking-tight">Ready to own CXG?</h3>
            <p className="mt-2 text-white/80">Buy with BNB or USDT on BNB Chain. Connect your wallet, choose your amount, and you’re in.</p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/client" className="rounded-lg bg-white px-5 py-3 text-sm font-medium text-black">Buy CXG+ now</Link>
              <Link href="#pricing" className="rounded-lg border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium hover:bg-white/10">See live market</Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer id="company" className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-6 py-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-block h-8 w-8 rounded bg-gradient-to-br from-yellow-500 to-amber-700" />
            <span className="font-semibold tracking-tight">CXG+</span>
          </div>
          <nav className="flex gap-6 text-sm text-white/75">
            <Link href="#privacy" className="hover:text-white">Privacy</Link>
            <Link href="#terms" className="hover:text-white">Terms</Link>
            <Link href="#status" className="hover:text-white">Status</Link>
            <Link href="#help" className="hover:text-white">Help</Link>
          </nav>
          <p className="text-xs text-white/60">© {new Date().getFullYear()} CXG+ Inc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
