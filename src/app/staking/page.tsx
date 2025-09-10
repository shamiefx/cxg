import Link from "next/link";
import AprCalculator from "./apr-calculator";

export default function StakingPage() {
  return (
    <div className="min-h-dvh px-6 py-10">
  <div className="mx-auto w-full max-w-5xl">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Staking — A Clear, Practical Guide</h1>
            <p className="mt-1 text-sm text-white/70">
              Understand how staking works, potential rewards, key risks, and how to choose a path that fits your goals.
            </p>
          </div>
          <div className="text-sm text-white/70">
            <Link href="/" className="hover:underline">← Back to home</Link>
          </div>
        </div>

        {/* Table of contents */}
        <nav className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs uppercase tracking-wide text-white/60">On this page</div>
          <ul className="mt-2 grid gap-1 text-sm text-white/80 sm:grid-cols-2">
            <li><a href="#what-is-staking" className="hover:underline">What staking is</a></li>
            <li><a href="#ways-to-stake" className="hover:underline">Ways to stake</a></li>
            <li><a href="#rewards" className="hover:underline">What affects rewards</a></li>
            <li><a href="#risks" className="hover:underline">Key risks</a></li>
            <li><a href="#choose-validator" className="hover:underline">Choose a validator</a></li>
            <li><a href="#quick-start" className="hover:underline">Quick start</a></li>
            <li><a href="#bsc-examples" className="hover:underline">BNB Smart Chain examples</a></li>
            <li><a href="#apr-examples" className="hover:underline">APR examples (calculator)</a></li>
            <li><a href="#builders" className="hover:underline">For builders</a></li>
            <li><a href="#glossary" className="hover:underline">Mini glossary</a></li>
          </ul>
        </nav>

        {/* What staking is */}
        <section id="what-is-staking" className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 scroll-mt-20">
          <h2 className="text-lg font-medium">What staking is</h2>
          <p className="mt-2 text-sm text-white/80">
            Staking means locking tokens to help run and secure a Proof‑of‑Stake (PoS) network. In return, you earn
            network rewards — typically newly issued tokens, a share of network fees, and sometimes MEV. Unlike mining,
            staking uses capital instead of hardware or energy.
          </p>
        </section>

        {/* Ways to stake */}
  <section id="ways-to-stake" className="mt-6 grid gap-4 lg:grid-cols-2 scroll-mt-20">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-medium">Common ways to stake</h2>
            <ul className="mt-3 space-y-3 text-sm text-white/80">
              <li>
                <span className="font-medium">Solo / validator staking.</span> Run your own validator. Highest control and responsibility
                (uptime, key security). Minimums vary by chain (e.g., 32 ETH for Ethereum).
              </li>
              <li>
                <span className="font-medium">Delegated / pooled staking.</span> Delegate your tokens to a validator. You keep custody
                on chains with native delegation; validator takes a commission from rewards.
              </li>
              <li>
                <span className="font-medium">Liquid staking (LSTs).</span> Stake and receive a liquid receipt token you can trade or use in DeFi.
                Improves liquidity, but adds smart‑contract and de‑peg risk.
              </li>
              <li>
                <span className="font-medium">CEX “staking”.</span> An exchange stakes on your behalf. Simplest UX with custodial risk and opaque fees.
              </li>
              <li>
                <span className="font-medium">Restaking.</span> Reuse a staked position (often via an LST) to secure additional networks/services for extra yield — with extra risk.
              </li>
            </ul>
          </div>
          <div id="rewards" className="rounded-2xl border border-white/10 bg-white/5 p-5 scroll-mt-20">
            <h2 className="text-lg font-medium">What affects rewards</h2>
            <ul className="mt-3 space-y-2 text-sm text-white/80 list-disc list-inside">
              <li>Network inflation and fee volume (more usage can mean more rewards)</li>
              <li>Your validator’s performance (uptime, missed blocks)</li>
              <li>Validator commission (their cut of rewards)</li>
              <li>Compounding (APR vs APY)</li>
              <li>Queueing/limits (some chains throttle entries and exits)</li>
            </ul>
          </div>
        </section>

        {/* Risks */}
  <section id="risks" className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 scroll-mt-20">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Key risks (read these!)</h2>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70">Transparency</span>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-white/80 list-disc list-inside">
            <li><span className="font-medium">Slashing & penalties:</span> Misbehavior or downtime can burn a slice of stake.</li>
            <li><span className="font-medium">Unbonding / withdrawal delays:</span> Funds may be locked for days–weeks; some chains use exit queues.</li>
            <li><span className="font-medium">Smart‑contract risk:</span> Applies to liquid, pooled, and restaking solutions.</li>
            <li><span className="font-medium">Custodial risk:</span> If a third party holds your keys (e.g., exchange).</li>
            <li><span className="font-medium">Price / volatility risk:</span> Rewards can be outweighed by token price moves.</li>
            <li><span className="font-medium">Protocol / governance changes:</span> Rules and yields can change over time.</li>
            <li><span className="font-medium">Regulatory / tax:</span> Jurisdiction‑dependent; seek professional advice if needed.</li>
          </ul>
        </section>

        {/* Choosing a validator */}
    <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h2 id="choose-validator" className="text-lg font-medium scroll-mt-20">How to choose a validator / provider</h2>
            <ul className="mt-3 space-y-2 text-sm text-white/80 list-disc list-inside">
              <li>Commission and historical uptime (low commission, strong performance)</li>
              <li>Decentralization (avoid over‑concentrated operators)</li>
              <li>Security track record (audits, slashing history)</li>
              <li>Self‑bond (“skin in the game”) and transparency</li>
              <li>Governance participation (informed voting and communication)</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 id="quick-start" className="text-lg font-medium scroll-mt-20">Quick start (generic flow)</h2>
            <ol className="mt-3 space-y-2 text-sm text-white/80 list-decimal list-inside">
              <li>Pick your chain (e.g., Ethereum, Solana, BNB Smart Chain).</li>
              <li>Decide the method: solo, delegate, liquid, or CEX.</li>
              <li>Select a validator/provider using the criteria above.</li>
              <li>Stake from a reputable wallet; confirm lockup and unbonding terms.</li>
              <li>Track rewards and restake if desired; keep keys and ops secure.</li>
              <li>Plan exits (understand withdrawal queues and tax impacts).</li>
            </ol>
          </div>
        </section>

        {/* BSC + other chain examples */}
        <section id="bsc-examples" className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 scroll-mt-20">
          <h2 className="text-lg font-medium">BNB Smart Chain (BSC) examples</h2>
          <p className="mt-2 text-sm text-white/80">Explore native resources and reputable tooling around BSC staking and validators.</p>
          <ul className="mt-3 space-y-2 text-sm text-yellow-300">
            <li>
              <a className="underline" href="https://www.bnbchain.org/en/staking" target="_blank" rel="noreferrer">BNB Chain — Staking portal</a>
            </li>
            <li>
              <a className="underline" href="https://www.binance.org/en/staking" target="_blank" rel="noreferrer">Binance — Staking overview (BNB Chain)</a>
            </li>
            <li>
              <a className="underline" href="https://bscscan.com/validators" target="_blank" rel="noreferrer">BscScan — Validators</a>
            </li>
          </ul>
          <div className="mt-4 text-xs text-white/60">
            Also see: <a className="underline text-yellow-300" href="https://ethereum.org/en/staking/" target="_blank" rel="noreferrer">Ethereum (ETH) staking</a> ·
            <a className="underline text-yellow-300 ml-1" href="https://solana.com/staking" target="_blank" rel="noreferrer">Solana staking</a>
          </div>
        </section>

        {/* APR examples */}
        <section id="apr-examples" className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 scroll-mt-20">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">APR examples (calculator)</h2>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70">Illustrative</span>
          </div>
          <p className="mt-2 text-sm text-white/80">
            Set an APR and compounding frequency to see the theoretical APY. Real yields vary by validator performance,
            fees, and network conditions. This is not a promise of returns.
          </p>
          <div className="mt-4">
            <AprCalculator />
          </div>
          <div className="mt-3 text-[11px] text-white/60">
            Disclaimer: APR figures for ETH/BNB/SOL are rough community estimates and change over time.
          </div>
        </section>

        {/* For builders */}
        <section id="builders" className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 scroll-mt-20">
          <h2 className="text-lg font-medium">For builders (token projects)</h2>
          <p className="mt-2 text-sm text-white/80">
            If you’re designing “staking” for your own token that doesn’t secure a base chain:
          </p>
          <ul className="mt-3 space-y-2 text-sm text-white/80 list-disc list-inside">
            <li>Be clear it’s a staking program (lock‑to‑earn), not consensus staking.</li>
            <li>Define a sustainable emission schedule and the yield source (fees, revenue share, buy‑backs).</li>
            <li>Specify lock periods, early‑exit penalties, reward math, caps, and audits.</li>
            <li>Beware calling it “staking” if rewards come solely from new emissions without utility — legal and reputational risks.</li>
          </ul>
        </section>

        {/* Glossary */}
        <section id="glossary" className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 scroll-mt-20">
          <h2 className="text-lg font-medium">Mini glossary</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 text-sm text-white/80">
            <div>
              <dt className="font-medium">APR vs APY</dt>
              <dd>APR is a yearly simple rate; APY includes compounding.</dd>
            </div>
            <div>
              <dt className="font-medium">Unbonding</dt>
              <dd>The time you must wait to withdraw staked funds.</dd>
            </div>
            <div>
              <dt className="font-medium">Slashing</dt>
              <dd>A penalty when a validator misbehaves; part of your stake can be burned.</dd>
            </div>
            <div>
              <dt className="font-medium">LST</dt>
              <dd>Liquid Staking Token — your claim on staked assets.</dd>
            </div>
            <div>
              <dt className="font-medium">Restaking</dt>
              <dd>Re‑using staked collateral to secure additional services for extra yield (adds risk).</dd>
            </div>
          </dl>
        </section>

        {/* Footer */}
        <div className="mt-8 text-sm text-white/70">
          Nothing here is financial, tax, or legal advice. Do your own research and seek professional guidance when needed.
        </div>
      </div>
    </div>
  );
}
