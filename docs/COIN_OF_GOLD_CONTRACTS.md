# Coin of Gold (CXGP) — Smart Contracts

Network: **BNB Smart Chain (BSC) Mainnet** (chainId: 56)
DApp: https://coin-of-gold.web.app/

## Addresses
| Component | Address |
|-----------|---------|
| Token (CXGP) | `0xA63F08a32639689DfF7b89FC5C12fF89dC687B34` |
| Token Sale (BNB/USDT + 3-tier referral) | `0x02b0364a53f2D82d8EcBB4ccF058A44784f0dc3c` |
| USDT (BSC, 18 decimals) | `0x55d398326f99059fF775485246999027B3197955` |
| Admin / Treasury | `0x4d3E834cF6a6b8ACC54cd96270b0a23065E63B68` |

## Quick Overview
**Token:** ERC-20 (OpenZeppelin v5) mintable (MINTER_ROLE) & burnable (any holder).
**Sale:** Users buy CXGP with BNB or USDT; funds go directly to Treasury.
**Referral:** 3 tiers (0.20% / 0.10% / 0.10%) paid from buyer’s tokens (buyer receives net).
**Controls:** Admin can pause, set prices, referral bps, treasury.

## Tech Stack & Build
- Solidity: ^0.8.24
- OpenZeppelin: 5.0.2
- Upgradeability: None (non-proxy)
- Verification: Both contracts verified on BscScan
- Keep compiler settings (optimizer + runs, viaIR) aligned for verification.

---
## 1. Token Contract — `CXGPlusToken`
Features:
- Name: Coin of Gold (CXGP)
- Decimals: 18
- Minting: Unlimited via MINTER_ROLE (Sale contract granted)
- Burning: `burn` / `burnFrom`
- Roles: `DEFAULT_ADMIN_ROLE`, `MINTER_ROLE`

Important Read Functions: `name`, `symbol`, `decimals`, `totalSupply`, `balanceOf`, `allowance`, `hasRole`
Important Write Functions:
- `mint(address to, uint256 amount)` — MINTER_ROLE
- `setMinter(address, bool)` — ADMIN
- `burn(uint256)` / `burnFrom(address,uint256)`
- Standard ERC20 `approve`, `transfer`, `transferFrom`

Events: `Transfer`, `Approval`, `RoleGranted`, `RoleRevoked`, `RoleAdminChanged`

Post-Deploy: `setMinter(0x02b0364a53f2D82d8EcBB4ccF058A44784f0dc3c, true)`

---
## 2. Token Sale — `TokenSaleWithReferrals`
Purpose: Accept BNB or USDT, mint net CXGP to buyers, referral tokens to uplines, forward funds to Treasury.

Defaults (editable):
- Price BNB: `priceWeiPerToken = 2.5e15` (0.0025 BNB)
- Price USDT: `priceUsdtPerToken18 = 2.5e18` (2.5 USDT)
- Referrals: tier1=20 bps (0.20%), tier2=10, tier3=10

Key Storage: `token`, `usdt`, `treasury`, `priceWeiPerToken`, `priceUsdtPerToken18`, `paused`, `tier*Bps`, `sponsorOf`.

Public Buyer Functions:
- `buyWithBNB(address sponsor)` (payable)
- `buyWithUSDT(uint256 amount, address sponsor)` (requires prior approve)
- `buyFree(address to, uint256 tokensGross, address sponsor)` (Admin only)

Quotes / Helpers: `quoteTokensForBNB`, `quoteTokensForUSDT`, `quoteReferralSplit`, `getUplines`

Admin: `pause`, `setPrices`, `setReferralBps`, `setTreasury`

Events: `Purchased`, `ReferralPaid`, `SponsorBound`, `PricesUpdated`, `TreasuryUpdated`, `Paused`

---
## 3. Referral Math
```
r1 = gross * tier1Bps / 10_000
r2 = gross * tier2Bps / 10_000
r3 = gross * tier3Bps / 10_000
net = gross - (r1 + r2 + r3)
```
Example: 0.1 BNB @ 0.0025 → gross 40 tokens, r1=0.08, r2=0.04, r3=0.04 → net 39.84

---
## 4. User Flows
A) BNB: `buyWithBNB(sponsor)` attach value → net tokens + referral tokens minted → BNB to Treasury.
B) USDT: `approve` → `buyWithUSDT(amount, sponsor)` → USDT to Treasury → tokens minted.
C) Free Mint: `buyFree` (admin gas-only mint).

---
## 5. Frontend (ethers v6)
```ts
const SALE = "0x02b0364a53f2D82d8EcBB4ccF058A44784f0dc3c";
const USDT = "0x55d398326f99059fF775485246999027B3197955";

const sale = new ethers.Contract(SALE, saleAbi, signer);
const usdt = new ethers.Contract(USDT, erc20Abi, signer);

await sale.buyWithBNB(ethers.ZeroAddress, { value: ethers.parseEther("0.1") });
const usdtAmt = ethers.parseUnits("100", 18);
await usdt.approve(SALE, usdtAmt);
await sale.buyWithUSDT(usdtAmt, ethers.ZeroAddress);
```

---
## 6. Admin Runbook
- Pause: `pause(true|false)`
- Prices: `setPrices(weiPerToken, usdtPerToken18)`
- Referrals: `setReferralBps(bps1,bps2,bps3)`
- Treasury: `setTreasury(newAddr)`
- Stop Mint: token `setMinter(Sale,false)`

---
## 7. Verification Notes
Token constructor: `constructor(address admin_)`
Sale constructor: `constructor(address admin_, address token_, address usdt_, address treasury_)`
(Keep ABI-encoded args + compiler settings.)

---
## 8. Labels (BscScan)
- Token: Coin of Gold (CXGP)
- Sale: Coin of Gold: Token Sale (BNB/USDT)
- Treasury: Coin of Gold: Treasury
- LP: PancakeSwap: CXGP/BNB

---
## 9. Security
- Unlimited mint via MINTER_ROLE (sale); disclose clearly.
- Manual pricing — monitor market alignment.
- Referrals inflate supply (part of purchase design).
- Recommend external audit before scale.

---
## 10. Changelog v1.0
- Token deployed & verified
- Sale deployed & verified
- MINTER_ROLE granted

## 11. License
MIT

## Contact
Treasury/Admin: `0x4d3E834cF6a6b8ACC54cd96270b0a23065E63B68`
DApp: https://coin-of-gold.web.app/
