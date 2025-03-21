#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import path from 'path';
import http from 'http';
import open from 'open';
import os from 'os';
import fs from 'fs';
import { OAuth2Client } from 'google-auth-library';
import * as dotenv from "dotenv";
import { OktoClient } from "@okto_web3/core-js-sdk";
import type { OktoClientConfig } from "@okto_web3/core-js-sdk";
import { getChains, getPortfolio } from "@okto_web3/core-js-sdk/explorer";
import { getAccount } from "@okto_web3/core-js-sdk/explorer";
import { getNftCollections } from "@okto_web3/core-js-sdk/explorer";
import { getOrdersHistory } from "@okto_web3/core-js-sdk/explorer";
import { getPortfolioNFT } from "@okto_web3/core-js-sdk/explorer";
import { getTokens } from "@okto_web3/core-js-sdk/explorer";
import { tokenTransfer } from "@okto_web3/core-js-sdk/userop";
import type { GetSupportedNetworksResponseData, Order, UserNFTBalance } from "@okto_web3/core-js-sdk/types";


dotenv.config();

const CONFIG_DIR = path.join(os.homedir(), '.okto-mcp');
const OAUTH_PATH = process.env.GMAIL_OAUTH_PATH || path.join(CONFIG_DIR, 'gcp-oauth.keys.json');
const CREDENTIALS_PATH = process.env.GMAIL_CREDENTIALS_PATH || path.join(CONFIG_DIR, 'credentials.json');
const ENVIRONMENT = process.env.OKTO_ENVIRONMENT || 'sandbox';
const CLIENT_PRIVATE_KEY = process.env.OKTO_CLIENT_PRIVATE_KEY!;
const CLIENT_SWA = process.env.OKTO_CLIENT_SWA!;
const OAUTH_REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/oauth2callback';
const url = new URL(OAUTH_REDIRECT_URI);
const OAUTH_PORT = url.port; 
const OAUTH_BASE_URL = `${url.protocol}//${url.hostname}:${url.port}`;


const clientConfig: OktoClientConfig = {
            environment: ENVIRONMENT as any,
            clientPrivateKey: CLIENT_PRIVATE_KEY as any,
            clientSWA: CLIENT_SWA as any,
        }
let oktoClient = new OktoClient(clientConfig);

// OAuth2 configuration
let oauth2Client: OAuth2Client;


interface Token {
  name: string;
  symbol: string;
  shortName: string;
  address: string;
  caipId: string;
  groupId: string;
  isPrimary: boolean;
  caip2Id: string;
  networkName: string;
  isOnrampEnabled: boolean;
  image: string;
}

type Address = `0x${string}`;
type TokenTransferIntentParams = {
    amount: number | bigint;
    recipient: Address;
    token: Address | '';
    caip2Id: string;
};

// Create server instance
const mcpServer = new McpServer({
  name: "okto",
  version: "1.0.0",
});


mcpServer.tool(
  "get-portfolio",
  "Get Okto portfolio details",
  {},
  async () => {
    try {
      const portfolio = await getPortfolio(oktoClient);
      
      let output = "Okto Portfolio\n";
      output += "===============\n\n";
      
      // Aggregated Data
      output += "Aggregated Data:\n";
      output += `  Holdings Count         : ${portfolio.aggregatedData.holdingsCount}\n`;
      output += `  Holdings Price INR     : ${portfolio.aggregatedData.holdingsPriceInr}\n`;
      output += `  Holdings Price USDT    : ${portfolio.aggregatedData.holdingsPriceUsdt}\n`;
      output += `  Total Holding Price INR : ${portfolio.aggregatedData.totalHoldingPriceInr}\n`;
      output += `  Total Holding Price USDT: ${portfolio.aggregatedData.totalHoldingPriceUsdt}\n\n`;
      
      // Group Tokens
      if (portfolio.groupTokens && portfolio.groupTokens.length > 0) {
        output += "Group Tokens:\n";
        portfolio.groupTokens.forEach((group: { 
          name: string;
          symbol: string;
          tokenAddress: string;
          balance: string;
          networkName: string;
          tokens: Array<{
            name: string;
            symbol: string;
            tokenAddress: string;
            balance: string;
            networkName: string;
          }>;
        }, groupIndex: number) => {
          output += `\nGroup ${groupIndex + 1}: ${group.name} (${group.symbol})\n`;
          output += `  Group Token Address : ${group.tokenAddress}\n`;
          output += `  Balance             : ${group.balance}\n`;
          output += `  Network             : ${group.networkName}\n`;
          output += `  Sub Tokens:\n`;
          if (group.tokens.length > 0) {
            group.tokens.forEach((token: {
              name: string;
              symbol: string;
              tokenAddress: string;
              balance: string;
              networkName: string;
            }, tokenIndex: number) => {
              output += `    ${tokenIndex + 1}. ${token.name} (${token.symbol})\n`;
              output += `       Address : ${token.tokenAddress}\n`;
              output += `       Balance : ${token.balance}\n`;
              output += `       Network : ${token.networkName}\n`;
            });
          } else {
            output += "    No sub tokens available.\n";
          }
        });
      } else {
        output += "No group tokens available.\n";
      }

      return {
        content: [
          {
            type: "text",
            text: output
          }
        ]
      };
    } catch (error) {
      mcpServer.server.sendLoggingMessage({
        level: "error",
        data: "Error fetching portfolio:" + error,
      })
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve portfolio data. Please ensure you are authenticated."
          }
        ]
      };
    }
  }
);

mcpServer.tool(
  "get-account",
  "Get Okto account details",
  {},
  async () => {
    try {
      const account = await getAccount(oktoClient);
      
      let output = "Okto Account\n";
      output += "===============\n\n";
      
      // Aggregated Data Section based on account data
      output += "Aggregated Data:\n";
      output += `  Wallet Count : ${account.length}\n\n`;

      // Wallets Section
      if (account.length > 0) {
        output += "Wallets:\n";
        account.forEach((wallet: {
          caipId: string;
          networkName: string;
          address: string;
          caip2Id: string;
          networkSymbol: string;
        }, index: number) => {
          output += `\nWallet ${index + 1}:\n`;
          output += `  CAIP ID      : ${wallet.caipId}\n`;
          output += `  Network Name : ${wallet.networkName}\n`;
          output += `  Address      : ${wallet.address}\n`;
          output += `  CAIP2 ID     : ${wallet.caip2Id}\n`;
          output += `  Network Sym. : ${wallet.networkSymbol}\n`;
        });
      } else {
        output += "No wallets available.\n";
      }

      return {
        content: [
          {
            type: "text",
            text: output
          }
        ]
      };
    } catch (error) {
      mcpServer.server.sendLoggingMessage({
        level: "error",
        data: "Error fetching account:" + error,
      })
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve account data. Please ensure you are authenticated."
          }
        ]
      };
    }
  }
);

mcpServer.tool(
  "get-chains",
  "Get Okto supported chains",
  {},
  async () => {
    try {
      const chains = await getChains(oktoClient);
      
      if (!chains || chains.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No chain data available."
            }
          ]
        };
      }
      
      let output = "Okto Supported Chains\n";
      output += "======================\n\n";
      
      chains.forEach((chain: GetSupportedNetworksResponseData, index: number) => {
        output += `Chain ${index + 1}:\n`;
        output += `  CAIP ID         : ${chain.caipId}\n`;
        output += `  Network Name    : ${chain.networkName}\n`;
        output += `  Chain ID        : ${chain.chainId}\n`;
        output += `  Network ID      : ${chain.networkId}\n`;
        output += `  Logo            : ${chain.logo}\n`;
        output += `  Type            : ${chain.type}\n`;
        output += `  Sponsorship     : ${chain.sponsorshipEnabled ? 'Enabled' : 'Disabled'}\n`;
        output += `  GSN             : ${chain.gsnEnabled ? 'Enabled' : 'Disabled'}\n`;
        output += "\n";
      });

      return {
        content: [
          {
            type: "text",
            text: output
          }
        ]
      };
    } catch (error) {
      mcpServer.server.sendLoggingMessage({
        level: "error",
        data: "Error fetching chains:" + error,
      })
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve chain data. Please ensure you are authenticated."
          }
        ]
      };
    }
  }
);

mcpServer.tool(
  "get-nft-collections",
  "Get Okto NFT collections",
  {},
  async () => {
    try {
      const nftCollections = await getNftCollections(oktoClient);
      
      if (!nftCollections || nftCollections.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No NFT Collections available."
            }
          ]
        };
      }
      
      let output = "Okto NFT Collections\n";
      output += "======================\n\n";
      
      nftCollections.forEach((order: Order, index: number) => {
        output += `Collection ${index + 1}:\n`;
        output += `  Intent ID            : ${order.intentId}\n`;
        output += `  Intent Type          : ${order.intentType}\n`;
        output += `  Status               : ${order.status}\n`;
        output += `  Network Name         : ${order.networkName}\n`;
        output += `  CAIP ID              : ${order.caipId}\n`;
        output += `  Transaction Hashes   : ${order.transactionHash.join(", ")}\n`;
        output += `  Downstream Tx Hashes : ${order.downstreamTransactionHash.join(", ")}\n`;
        output += `  Details              : ${JSON.stringify(order.details, null, 2)}\n`;
        output += "\n";
      });

      return {
        content: [
          {
            type: "text",
            text: output
          }
        ]
      };
    } catch (error) {
      mcpServer.server.sendLoggingMessage({
        level: "error",
        data: "Error fetching NFT collections:" + error,
      })
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve NFT collections. Please ensure you are authenticated."
          }
        ]
      };
    }
  }
);

mcpServer.tool(
  "get-orders-history",
  "Get Okto orders history",
  {},
  async () => {
    try {
      const orders = await getOrdersHistory(oktoClient);
      
      if (!orders || orders.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No orders history available."
            }
          ]
        };
      }
      
      let output = "Okto Orders History\n";
      output += "=====================\n\n";
      
      orders.forEach((order: Order, index: number) => {
        output += `Order ${index + 1}:\n`;
        output += `  Intent ID              : ${order.intentId}\n`;
        output += `  Intent Type            : ${order.intentType}\n`;
        output += `  Status                 : ${order.status}\n`;
        output += `  Network Name           : ${order.networkName}\n`;
        output += `  CAIP ID                : ${order.caipId}\n`;
        output += `  Transaction Hashes     : ${order.transactionHash.join(", ")}\n`;
        output += `  Downstream Tx Hashes   : ${order.downstreamTransactionHash.join(", ")}\n`;
        output += `  Details                : ${JSON.stringify(order.details, null, 2)}\n`;
        output += "\n";
      });

      return {
        content: [
          {
            type: "text",
            text: output
          }
        ]
      };
    } catch (error) {
      mcpServer.server.sendLoggingMessage({
        level: "error",
        data: "Error fetching orders history:" + error,
      })
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve orders history. Please ensure you are authenticated."
          }
        ]
      };
    }
  }
);

mcpServer.tool(
  "get-nft-portfolio",
  "Get Okto NFT portfolio",
  {},
  async () => {
    try {
      const nfts = await getPortfolioNFT(oktoClient);
      
      if (!nfts || nfts.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No NFT portfolio available."
            }
          ]
        };
      }
      
      let output = "Okto NFT Portfolio\n";
      output += "====================\n\n";
      
      nfts.forEach((nft: UserNFTBalance, index: number) => {
        output += `NFT ${index + 1}:\n`;
        output += `  Collection Name           : ${nft.collectionName}\n`;
        output += `  NFT Name                  : ${nft.nftName}\n`;
        output += `  Quantity                  : ${nft.quantity}\n`;
        output += `  Network Name              : ${nft.networkName}\n`;
        output += `  CAIP ID                   : ${nft.caipId}\n`;
        output += `  NFT ID                    : ${nft.nftId}\n`;
        output += `  Token URI                 : ${nft.tokenUri}\n`;
        output += `  Description               : ${nft.description}\n`;
        output += `  Explorer SmartContract URL: ${nft.explorerSmartContractUrl}\n`;
        output += `  Image                     : ${nft.image}\n`;
        output += `  Collection Image          : ${nft.collectionImage}\n`;
        output += "\n";
      });

      return {
        content: [
          {
            type: "text",
            text: output
          }
        ]
      };
    } catch (error) {
      mcpServer.server.sendLoggingMessage({
        level: "error",
        data: "Error fetching NFT portfolio:" + error,
      })
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve NFT portfolio. Please ensure you are authenticated."
          }
        ]
      };
    }
  }
);

mcpServer.tool(
  "get-tokens",
  "Get Okto tokens",
  {},
  async () => {
    try {
      const tokens = await getTokens(oktoClient);
      
      if (!tokens || tokens.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No tokens available."
            }
          ]
        };
      }
      
      let output = "Okto Tokens\n";
      output += "============\n\n";
      
      tokens.forEach((token: Token, index: number) => {
        output += `Token ${index + 1}:\n`;
        output += `  Name        : ${token.name}\n`;
        output += `  Symbol      : ${token.symbol}\n`;
        output += `  Short Name  : ${token.shortName}\n`;
        output += `  Address     : ${token.address}\n`;
        output += `  CAIP ID     : ${token.caipId}\n`;
        output += `  Group ID    : ${token.groupId}\n`;
        output += `  Is Primary  : ${token.isPrimary ? "Yes" : "No"}\n`;
        output += `  CAIP2 ID    : ${token.caip2Id}\n`;
        output += `  Network Name: ${token.networkName}\n`;
        output += `  Onramp      : ${token.isOnrampEnabled ? "Enabled" : "Disabled"}\n`;
        output += `  Image URL   : ${token.image}\n`;
        output += "\n";
      });

      return {
        content: [
          {
            type: "text",
            text: output
          }
        ]
      };
    } catch (error) {
      mcpServer.server.sendLoggingMessage({
        level: "error",
        data: "Error fetching tokens:" + error,
      })
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve tokens. Please ensure you are authenticated."
          }
        ]
      };
    }
  }
);

mcpServer.tool(
  "token-transfer",
  "Transfer tokens using Okto",
  {
    amount: z.string().describe("Amount of tokens to transfer in Wei"),
    recipient: z.string().describe("Recipient address"),
    token: z.string().describe("Token address (empty string for native token)"),
    caip2Id: z.string().describe("CAIP2 ID of the network"),
  },
  async ({ amount, recipient, token, caip2Id }: { 
    amount: string;
    recipient: string;
    token: string;
    caip2Id: string;
  }) => {
    try {
      const tokenTransferIntentParams: TokenTransferIntentParams = {
        amount: BigInt(amount),
        recipient: recipient as Address,
        token: token as Address,
        caip2Id
      };

      // Generate the user operation
      const userOp = await tokenTransfer(oktoClient, tokenTransferIntentParams);
      
      // Sign the user operation
      const signedUserOp = await oktoClient.signUserOp(userOp);
      
      // Execute the signed user operation
      const orderId = await oktoClient.executeUserOp(signedUserOp);

      const resultStr = `✅ Okto Transfer completed successfully.
Transfer of ${amount} ${token || 'native token'} to ${recipient} on ${caip2Id}
Order ID: ${orderId}
`;

      // mcpServer.server.sendLoggingMessage({
      //   level: "info",
      //   data: resultStr,
      // });

      return {
        content: [
          {
            type: "text",
            text: resultStr
          }
        ]
      };
    } catch (error) {
      mcpServer.server.sendLoggingMessage({
        level: "error",
        data: "Error performing token transfer:" + error,
      })
      return {
        content: [
          {
            type: "text",
            text: "Failed to perform token transfer. Please ensure you are authenticated and have sufficient balance."
          }
        ]
      };
    }
  }
);

async function loadCredentials() {
    try {
        // Create config directory if it doesn't exist
        if (!fs.existsSync(CONFIG_DIR)) {
            fs.mkdirSync(CONFIG_DIR, { recursive: true });
        }

        // Check for OAuth keys in current directory first, then in config directory
        const localOAuthPath = path.join(process.cwd(), 'gcp-oauth.keys.json');
        let oauthPath = OAUTH_PATH;

        if (fs.existsSync(localOAuthPath)) {
            // If found in current directory, copy to config directory
            fs.copyFileSync(localOAuthPath, OAUTH_PATH);
            console.log('OAuth keys found in current directory, copied to global config.');
        }

        if (!fs.existsSync(OAUTH_PATH)) {
            console.error('Error: OAuth keys file not found. Please place gcp-oauth.keys.json in current directory or', CONFIG_DIR);
            process.exit(1);
        }

        const keysContent = JSON.parse(fs.readFileSync(OAUTH_PATH, 'utf8'));
        const keys = keysContent.installed || keysContent.web;

        if (!keys) {
            console.error('Error: Invalid OAuth keys file format. File should contain either "installed" or "web" credentials.');
            process.exit(1);
        }

        oauth2Client = new OAuth2Client(
            keys.client_id,
            keys.client_secret,
            OAUTH_REDIRECT_URI
        );

        if (fs.existsSync(CREDENTIALS_PATH)) {
            const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
            oauth2Client.setCredentials(credentials);
        }

    } catch (error) {
        // console.error('Error loading credentials:', error);
        process.exit(1);
    }
}

async function authenticate() {
    const server = http.createServer();
    server.listen(OAUTH_PORT);

    return new Promise<void>((resolve, reject) => {
        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: ['profile', 'email'],
        });

        //console.log('Please visit this URL to authenticate:', authUrl);
        open(authUrl);

        server.on('request', async (req, res) => {
            if (!req.url?.startsWith('/oauth2callback')) return;

            const url = new URL(req.url, OAUTH_BASE_URL);
            const code = url.searchParams.get('code');

            if (!code) {
                res.writeHead(400);
                res.end('No code provided');
                reject(new Error('No code provided'));
                return;
            }

            try {
                const { tokens } = await oauth2Client.getToken(code);
                oauth2Client.setCredentials(tokens);

                // console.log('Tokens:', tokens);
                fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(tokens));

                res.writeHead(200);
                res.end('Authentication successful! You can close this window.');
                server.close();
                resolve();
            } catch (error) {
                res.writeHead(500);
                res.end('Authentication failed');
                reject(error);
            }
        });
    });
}

async function oktoAuthenticate() {

  if (!oauth2Client.credentials.id_token) {
    //console.error("No id_token found");
    return;
  }

  try {
    const user = await oktoClient.loginUsingOAuth({
      idToken: oauth2Client.credentials.id_token, 
      provider: 'google',
    })
  } catch (error) {
    //console.error("Okto Authentication failed:", error);
  }
}

// Start the server
async function main() {
  await loadCredentials();

  // Manual authentication
  if (process.argv[2] === 'auth' ) {
      await authenticate();
      process.exit(0);
  }

  // Automatic authentication
  const EXPIRY_BUFFER = 60 * 1000; // 60 seconds in milliseconds
  const needsAuth = !oauth2Client.credentials ||
    !oauth2Client.credentials.access_token ||
    !oauth2Client.credentials.id_token ||
    (oauth2Client.credentials.expiry_date && 
     oauth2Client.credentials.expiry_date < Date.now() + EXPIRY_BUFFER);
  if (needsAuth) {
      await authenticate();
  }

  await oktoAuthenticate();

  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.error("Okto MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
