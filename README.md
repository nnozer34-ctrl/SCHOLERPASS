ScholarPass 🎓⛓️
Academic Digital Identity & Verifiable Credential Platform

ScholarPass is a decentralized application (dApp) built on the Stellar Network using Soroban Smart Contracts. It provides a secure, immutable, and transparent way to issue, store, and verify academic achievements and certificates.

🚀 Overview
Traditional academic certificates are prone to forgery and slow to verify. ScholarPass solves this by creating a "Digital Notary" system:

Hashing: Documents are hashed into a unique CID via IPFS.

Anchoring: This CID is permanently anchored to the Stellar Blockchain.

Verification: Employers and institutions can verify the authenticity of a document in seconds without contacting the issuer.

🛠️ Tech Stack
Blockchain: Stellar (Soroban Smart Contracts - Rust)

Storage: IPFS (via Pinata)

Frontend: React.js, Vite, TypeScript

Wallet: Freighter (Stellar Wallet)

Styling: CSS Modules (Glassmorphism UI)

🏗️ Architecture
ScholarPass follows an Off-chain Storage / On-chain Verification strategy:

Off-chain: Actual certificate files (PDF/Images) are stored on IPFS to save costs and maintain high performance.

On-chain: Only the unique CID (Content Identifier) and the issuer's signature are stored on the Stellar ledger.

📜 Proof of Concept (Transaction)
You can verify the latest contract interaction on the Stellar Testnet:

Transaction Hash:<img width="1413" height="461" alt="image" src="https://github.com/user-attachments/assets/58c47835-2306-4970-b7e8-708a4003fd67" />


⚙️ Installation & Setup
Clone the repository:

Bash
git clone https://github.com/yourusername/ScholarPass.git
cd ScholerPass
Install dependencies:

Bash
cd frontend
npm install
Configure Environment:
Create a .env file in the frontend directory and add your Pinata API keys:

Kod snippet'i
VITE_PINATA_JWT=your_jwt_here
Run the development server:

<img width="1705" height="946" alt="image" src="https://github.com/user-attachments/assets/eadba479-856e-4ffa-a2cb-9fb9a5a5fd60" />


Bash
npm run dev
🔮 Roadmap
[ ] Whitelist System: Only authorized educational institutions can issue certificates.

[ ] SBT Integration: Transitioning certificates into Soulbound Tokens (Non-transferable NFTs).

[ ] QR Code Verification: Generate unique QR codes for physical certificates for instant mobile verification.
