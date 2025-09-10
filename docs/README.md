# Coin of Gold (CXGP) — Smart Contracts

**Network:** BNB Smart Chain (BSC) Mainnet (`chainId: 56`)  
**Website/DApp:** https://coin-of-gold.web.app/

## Addresses

| Component | Address |
|---|---|
| **Token (CXGP)** | `0xA63F08a32639689DfF7b89FC5C12fF89dC687B34` |
| **Token Sale (BNB/USDT + 3-tier referral)** | `0x02b0364a53f2D82d8EcBB4ccF058A44784f0dc3c` |
| **USDT (BSC, 18 decimals)** | `0x55d398326f99059fF775485246999027B3197955` |
| **Admin / Treasury** | `0x4d3E834cF6a6b8ACC54cd96270b0a23065E63B68` |

---

## Overview

- **Token**: ERC-20 (OpenZeppelin v5), **mintable** (by MINTER_ROLE) and **burnable** (any holder).
- **Sale**: Buy CXGP with **BNB** or **USDT**. Funds are forwarded **directly** to Treasury.  
  3-tier referral (0.20% / 0.10% / 0.10%) is **paid from buyer’s tokens** (buyer receives *net*).
- **Controls**: Admin can **pause/unpause**, update prices, referral bps, and treasury.

## Build / Tooling

- **Solidity:** `^0.8.24`
- **OpenZeppelin:** `@openzeppelin/contracts@5.0.2`
- **Upgradeability:** None (both contracts are non-proxy)
- **Verification:** Verified on BscScan
- **Stack:** Hardhat + Ethers + dotenv

---

## 1) Token Contract — `CXGPlusToken`

### Features
- **Name / Symbol / Decimals:** Coin of Gold (CXGP) / 18
- **Minting:** Unlimited; only addresses with `MINTER_ROLE` can `mint()`.
- **Burning:** Any holder can `burn(amount)` or `burnFrom(holder, amount)`.
- **Roles (AccessControl):**
  - `DEFAULT_ADMIN_ROLE` — full admin (grant/revoke roles, set minters)
  - `MINTER_ROLE` — allowed to `mint()`

### Key Functions
- **Read:** `name()`, `symbol()`, `decimals()`, `totalSupply()`, `balanceOf()`, `allowance()`, `hasRole()`
- **Write:** `mint(to, amount)`, `setMinter(account, enabled)`, `burn(amount)`, `burnFrom(holder, amount)`

### Post-Deploy
Grant Sale contract permission to mint:
```
setMinter(0x02b0364a53f2D82d8EcBB4ccF058A44784f0dc3c, true)
```

---

## 2) Token Sale Contract — `TokenSaleWithReferrals`

### What it does
- Accepts **BNB** (native) or **USDT (18d)** to mint CXGP to buyers.
- Forwards **100%** of received BNB/USDT directly to **Treasury**.
- **3-tier referral** (L1/L2/L3): **0.20% / 0.10% / 0.10%** paid from buyer’s tokens (buyer gets **net**).
- Binds sponsor on first purchase (`sponsorOf[buyer]` is locked thereafter).

### Defaults (editable by Admin)
- **priceWeiPerToken** = `2.5e15` wei → **0.0025 BNB / token**
- **priceUsdtPerToken18** = `2.5e18` → **2.5 USDT / token**
- **Referral BPS:** `tier1Bps=20`, `tier2Bps=10`, `tier3Bps=10`

### Main Functions
- **Buy:** `buyWithBNB(sponsor)` (payable), `buyWithUSDT(usdtAmount, sponsor)` (after `approve`), `buyFree(to, tokensGross, sponsor)` (admin)
- **Quote:** `quoteTokensForBNB(wei)`, `quoteTokensForUSDT(amount)`, `quoteReferralSplit(gross)`
- **Admin:** `pause(bool)`, `setPrices(newWei, newUsdt18)`, `setReferralBps(b1,b2,b3)`, `setTreasury(addr)`
- **Views:** `sponsorOf(user)`, `getUplines(user)`, price getters, `paused()`, `token()`, `usdt()`, `treasury()`

### Example (referral math)
`gross = payment / price`  
`r1 = gross * 20 / 10_000`, `r2 = gross * 10 / 10_000`, `r3 = gross * 10 / 10_000`  
`net = gross - (r1 + r2 + r3)` → minted to **buyer**, sponsors receive `r1/r2/r3`.

---

## 3) Frontend (ethers v6)

```js
import { ethers } from "ethers";

const ADDR = {
  TOKEN:   "0xA63F08a32639689DfF7b89FC5C12fF89dC687B34",
  SALE:    "0x02b0364a53f2D82d8EcBB4ccF058A44784f0dc3c",
  USDT:    "0x55d398326f99059fF775485246999027B3197955",
  TREASURY:"0x4d3E834cF6a6b8ACC54cd96270b0a23065E63B68",
};

// Buy with BNB
await sale.buyWithBNB(ethers.ZeroAddress, { value: ethers.parseEther("0.1") });

// Buy with USDT
const amt = ethers.parseUnits("100", 18);
await usdt.approve(ADDR.SALE, amt);
await sale.buyWithUSDT(amt, ethers.ZeroAddress);

// Quotes
const gross = await sale.quoteTokensForBNB(ethers.parseEther("0.1"));
const [net, r1, r2, r3] = await sale.quoteReferralSplit(gross);
```

---

## 3.1) Balances (in the DApp)

The Balances panel shows the connected wallet’s balances and the token supply. Below is the equivalent using ethers v6:

```js
import { ethers, formatUnits } from "ethers";

const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();
const user = await signer.getAddress();

const USDT = "0x55d398326f99059fF775485246999027B3197955"; // 18 decimals on BSC
const CXGP = "0xA63F08a32639689DfF7b89FC5C12fF89dC687B34"; // from env in the app

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
];

// BNB (native)
const bnbWei = await provider.getBalance(user);
const bnb = formatUnits(bnbWei, 18); // e.g., 0.0001

// USDT (ERC-20, 18d on BSC)
const usdt = new ethers.Contract(USDT, ERC20_ABI, provider);
const usdtBal = formatUnits(await usdt.balanceOf(user), 18); // e.g., 0.0000

// CXGP (ERC-20)
const cxgp = new ethers.Contract(CXGP, ERC20_ABI, provider);
const cxgpBal = formatUnits(await cxgp.balanceOf(user), 18); // e.g., 9,999,978.9183

// Supply (token total supply)
const supply = formatUnits(await cxgp.totalSupply(), 18); // e.g., 10,000,000.0000
```

In the app, values are formatted to 4 decimals. To see real numbers:
- Set token/sale envs in `.env` and rebuild the app.
- Connect a wallet on BSC Mainnet.

Display formatting (4 decimals, thousands separator):

```js
const fmt4 = (valueString) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 })
    .format(Number(valueString));

console.log("BNB", fmt4(bnb));        // e.g., BNB 0.0001
console.log("USDT", fmt4(usdtBal));   // e.g., USDT 0.0000
console.log("CXGP", fmt4(cxgpBal));   // e.g., CXGP 9,999,978.9183
console.log("Supply", fmt4(supply));  // e.g., Supply 10,000,000.0000
```

## 4) Hardhat Usage

### Install
```bash
npm i
```

### Env
Create `.env`:
```
BSC_RPC=https://bsc-dataseed.binance.org/
PRIVATE_KEY=0xYOUR_PRIVATE_KEY 
BSCSCAN_KEY=<YOUR_BSCSCAN_KEY>
ADMIN=0x4d3E834cF6a6b8ACC54cd96270b0a23065E63B68
TOKEN=0xA63F08a32639689DfF7b89FC5C12fF89dC687B34
USDT=0x55d398326f99059fF775485246999027B3197955
TREASURY=0x4d3E834cF6a6b8ACC54cd96270b0a23065E63B68
SALE=0x02b0364a53f2D82d8EcBB4ccF058A44784f0dc3c
```

### Compile
```bash
npx hardhat compile
```

### Verify (examples)
```bash
# Token (admin=treasury)
npx hardhat verify --network bsc 0xA63F08a32639689DfF7b89FC5C12fF89dC687B34 0x4d3E834cF6a6b8ACC54cd96270b0a23065E63B68

# Sale (admin, token, usdt, treasury)
npx hardhat verify --network bsc 0x02b0364a53f2D82d8EcBB4ccF058A44784f0dc3c   0x4d3E834cF6a6b8ACC54cd96270b0a23065E63B68   0xA63F08a32639689DfF7b89FC5C12fF89dC687B34   0x55d398326f99059fF775485246999027B3197955   0x4d3E834cF6a6b8ACC54cd96270b0a23065E63B68
```

---

## 5) Security Notes
- Unlimited minting is sale-driven; communicate clearly to users.
- Prices are manual (no oracle). Keep them aligned with LP if listed.
- Referrals increase distribution; buyer receives **net** amount.
- Consider external review before scaling.
