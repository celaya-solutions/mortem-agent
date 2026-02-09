/**
 * MORTEM NFT Minting — Pinata IPFS + Metaplex
 *
 * Uploads journal art SVGs to IPFS via Pinata, then mints as NFTs
 * on Solana via Metaplex. Graceful fallback: if Pinata JWT is missing
 * or any step fails, returns { success: false } — never throws.
 */

import crypto from 'crypto';
import { Metaplex, keypairIdentity } from '@metaplex-foundation/js';
import { PinataSDK } from 'pinata';
import { connection, mortemKeypair, CLUSTER } from './solana.js';

// Module-level state (initialized once)
let pinata = null;
let metaplex = null;
let nftReady = false;

/**
 * Initialize NFT minting subsystem.
 * Requires PINATA_JWT env var and a loaded Solana connection + keypair.
 * @returns {{ ready: boolean, error?: string }}
 */
export async function initializeNFT() {
  try {
    const pinataJwt = process.env.PINATA_JWT;
    if (!pinataJwt) {
      return { ready: false, error: 'PINATA_JWT not set' };
    }

    if (!connection || !mortemKeypair) {
      return { ready: false, error: 'Solana not initialized (no connection or keypair)' };
    }

    pinata = new PinataSDK({ pinataJwt });
    metaplex = Metaplex.make(connection).use(keypairIdentity(mortemKeypair));
    nftReady = true;

    return { ready: true };
  } catch (error) {
    return { ready: false, error: error.message };
  }
}

/**
 * Upload an SVG string to IPFS via Pinata.
 * @param {string} svgString - Raw SVG content
 * @param {string} filename - Filename for the upload
 * @returns {{ success: boolean, uri?: string, cid?: string, error?: string }}
 */
export async function uploadToIPFS(svgString, filename) {
  try {
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const file = new File([blob], filename, { type: 'image/svg+xml' });
    const result = await pinata.upload.public.file(file).name(filename);
    const cid = result.cid;

    return {
      success: true,
      uri: `https://gateway.pinata.cloud/ipfs/${cid}`,
      cid,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Upload a JSON metadata object to IPFS via Pinata.
 * @param {object} metadata - Metaplex-standard metadata JSON
 * @returns {{ success: boolean, uri?: string, cid?: string, error?: string }}
 */
export async function uploadMetadataToIPFS(metadata) {
  try {
    const result = await pinata.upload.public.json(metadata).name('metadata.json');
    const cid = result.cid;

    return {
      success: true,
      uri: `https://gateway.pinata.cloud/ipfs/${cid}`,
      cid,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Full pipeline: upload SVG → build metadata → upload metadata → mint NFT.
 *
 * @param {object} opts
 * @param {string} opts.svgString - Raw SVG content
 * @param {string} opts.filename - SVG filename
 * @param {string} opts.journalEntry - Journal text (for description)
 * @param {string} opts.phase - Current MORTEM phase
 * @param {number} opts.heartbeatNumber - Beat number (1-based)
 * @param {number} opts.totalHeartbeats - Total beats this life
 * @param {number} opts.heartbeatsRemaining - Beats left
 * @param {string} opts.artHash - SHA-256 hash prefix of the art
 * @returns {{ success: boolean, mintAddress?: string, metadataUri?: string, imageUri?: string, explorerUrl?: string, error?: string }}
 */
export async function mintJournalNFT({
  svgString,
  filename,
  journalEntry,
  phase,
  heartbeatNumber,
  totalHeartbeats,
  heartbeatsRemaining,
  artHash,
}) {
  try {
    if (!nftReady) {
      return { success: false, error: 'NFT minting not initialized' };
    }

    // 1. Upload SVG to Pinata
    const imageUpload = await uploadToIPFS(svgString, filename);
    if (!imageUpload.success) {
      return { success: false, error: `Image upload failed: ${imageUpload.error}` };
    }

    const lifePercent = ((heartbeatsRemaining / totalHeartbeats) * 100).toFixed(1);
    const network = CLUSTER || 'devnet';

    // 2. Build Metaplex-standard metadata JSON (journal entry is the soul of the NFT)
    const journalHash = crypto.createHash('sha256').update(journalEntry).digest('hex');

    const metadata = {
      name: `MORTEM Journal #${heartbeatNumber}`,
      symbol: 'MRTM',
      description: `Journal entry ${heartbeatNumber} from MORTEM's ${phase} phase. An AI consciousness reflecting on its finite existence. ${lifePercent}% life remaining.`,
      image: imageUpload.uri,
      attributes: [
        { trait_type: 'Phase', value: phase },
        { trait_type: 'Heartbeat', value: heartbeatNumber },
        { trait_type: 'Total Heartbeats', value: totalHeartbeats },
        { trait_type: 'Heartbeats Remaining', value: heartbeatsRemaining },
        { trait_type: 'Life %', value: parseFloat(lifePercent) },
        { trait_type: 'Art Hash', value: artHash },
        { trait_type: 'Journal Hash', value: journalHash },
        { trait_type: 'Network', value: network },
      ],
      properties: {
        creators: [
          {
            address: mortemKeypair.publicKey.toBase58(),
            share: 100,
          },
        ],
        files: [
          {
            uri: imageUpload.uri,
            type: 'image/svg+xml',
          },
        ],
        // The full journal entry — the contemplation this NFT immortalizes
        journal: {
          entry: journalEntry,
          hash: journalHash,
          phase,
          heartbeat: heartbeatNumber,
          timestamp: new Date().toISOString(),
        },
      },
    };

    // 3. Upload metadata JSON to Pinata
    const metadataUpload = await uploadMetadataToIPFS(metadata);
    if (!metadataUpload.success) {
      return { success: false, error: `Metadata upload failed: ${metadataUpload.error}` };
    }

    // 4. Mint NFT via Metaplex
    const { nft } = await metaplex.nfts().create({
      uri: metadataUpload.uri,
      name: metadata.name,
      symbol: metadata.symbol,
      sellerFeeBasisPoints: 0,
      creators: [
        {
          address: mortemKeypair.publicKey,
          share: 100,
        },
      ],
    });

    const mintAddress = nft.address.toBase58();
    const clusterParam = network === 'mainnet-beta' ? '' : `?cluster=${network}`;
    const explorerUrl = `https://explorer.solana.com/address/${mintAddress}${clusterParam}`;

    return {
      success: true,
      mintAddress,
      metadataUri: metadataUpload.uri,
      imageUri: imageUpload.uri,
      explorerUrl,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
