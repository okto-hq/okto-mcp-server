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
import { OktoClientConfig } from "@okto_web3/core-js-sdk";
import { getChains, getPortfolio } from "@okto_web3/core-js-sdk/explorer";
import { getAccount } from "@okto_web3/core-js-sdk/explorer";
import { getNftCollections } from "@okto_web3/core-js-sdk/explorer";
import { getOrdersHistory } from "@okto_web3/core-js-sdk/explorer";
import { getPortfolioNFT } from "@okto_web3/core-js-sdk/explorer";
import { getTokens } from "@okto_web3/core-js-sdk/explorer";
import { GetSupportedNetworksResponseData, Order, UserNFTBalance } from "@okto_web3/core-js-sdk/types";


dotenv.config();

const NWS_API_BASE = "https://api.weather.gov";
const USER_AGENT = "weather-app/1.0";
const CONFIG_DIR = path.join(os.homedir(), '.okto-mcp');
const OAUTH_PATH = process.env.GMAIL_OAUTH_PATH || path.join(CONFIG_DIR, 'gcp-oauth.keys.json');
const CREDENTIALS_PATH = process.env.GMAIL_CREDENTIALS_PATH || path.join(CONFIG_DIR, 'credentials.json');
const ENVIRONMENT = process.env.OKTO_ENVIRONMENT || 'sandbox';
const CLIENT_PRIVATE_KEY = process.env.OKTO_CLIENT_PRIVATE_KEY!;
const CLIENT_SWA = process.env.OKTO_CLIENT_SWA!;


const clientConfig: OktoClientConfig = {
            environment: ENVIRONMENT as any,
            clientPrivateKey: CLIENT_PRIVATE_KEY as any,
            clientSWA: CLIENT_SWA as any,
        }
let oktoClient = new OktoClient(clientConfig);

// OAuth2 configuration
let oauth2Client: OAuth2Client;


// Helper function for making NWS API requests
async function makeNWSRequest<T>(url: string): Promise<T | null> {
  const headers = {
    "User-Agent": USER_AGENT,
    Accept: "application/geo+json",
  };

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error("Error making NWS request:", error);
    return null;
  }
}

interface AlertFeature {
  properties: {
    event?: string;
    areaDesc?: string;
    severity?: string;
    status?: string;
    headline?: string;
  };
}

// Format alert data
function formatAlert(feature: AlertFeature): string {
  const props = feature.properties;
  return [
    `Event: ${props.event || "Unknown"}`,
    `Area: ${props.areaDesc || "Unknown"}`,
    `Severity: ${props.severity || "Unknown"}`,
    `Status: ${props.status || "Unknown"}`,
    `Headline: ${props.headline || "No headline"}`,
    "---",
  ].join("\n");
}

interface ForecastPeriod {
  name?: string;
  temperature?: number;
  temperatureUnit?: string;
  windSpeed?: string;
  windDirection?: string;
  shortForecast?: string;
}

interface AlertsResponse {
  features: AlertFeature[];
}

interface PointsResponse {
  properties: {
    forecast?: string;
  };
}

interface ForecastResponse {
  properties: {
    periods: ForecastPeriod[];
  };
}

interface Wallet {
  caipId: string;
  networkName: string;
  address: string;
  caip2Id: string;
  networkSymbol: string;
}

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

// Create server instance
const mcpServer = new McpServer({
  name: "okto",
  version: "1.0.0",
});

// Register weather tools
// mcpServer.tool(
//   "get-alerts",
//   "Get weather alerts for a state",
//   {
//     state: z.string().length(2).describe("Two-letter state code (e.g. CA, NY)"),
//   },
//   async ({ state }: { state: string }) => {
//     const stateCode = state.toUpperCase();
//     const alertsUrl = `${NWS_API_BASE}/alerts?area=${stateCode}`;
//     const alertsData = await makeNWSRequest<AlertsResponse>(alertsUrl);

//     if (!alertsData) {
//       return {
//         content: [
//           {
//             type: "text",
//             text: "Failed to retrieve alerts data",
//           },
//         ],
//       };
//     }

//     const features = alertsData.features || [];
//     if (features.length === 0) {
//       return {
//         content: [
//           {
//             type: "text",
//             text: `No active alerts for ${stateCode}`,
//           },
//         ],
//       };
//     }

//     const formattedAlerts = features.map(formatAlert);
//     const alertsText = `Active alerts for ${stateCode}:\n\n${formattedAlerts.join("\n")}`;

//     return {
//       content: [
//         {
//           type: "text",
//           text: alertsText,
//         },
//       ],
//     };
//   },
// );

// mcpServer.tool(
//   "get-forecast",
//   "Get weather forecast for a location",
//   {
//     latitude: z.number().min(-90).max(90).describe("Latitude of the location"),
//     longitude: z.number().min(-180).max(180).describe("Longitude of the location"),
//   },
//   async ({ latitude, longitude }: { latitude: number; longitude: number }) => {
//     // Get grid point data
//     const pointsUrl = `${NWS_API_BASE}/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`;
//     const pointsData = await makeNWSRequest<PointsResponse>(pointsUrl);

//     if (!pointsData) {
//       return {
//         content: [
//           {
//             type: "text",
//             text: `Failed to retrieve grid point data for coordinates: ${latitude}, ${longitude}. This location may not be supported by the NWS API (only US locations are supported).`,
//           },
//         ],
//       };
//     }

//     const forecastUrl = pointsData.properties?.forecast;
//     if (!forecastUrl) {
//       return {
//         content: [
//           {
//             type: "text",
//             text: "Failed to get forecast URL from grid point data",
//           },
//         ],
//       };
//     }

//     // Get forecast data
//     const forecastData = await makeNWSRequest<ForecastResponse>(forecastUrl);
//     if (!forecastData) {
//       return {
//         content: [
//           {
//             type: "text",
//             text: "Failed to retrieve forecast data",
//           },
//         ],
//       };
//     }

//     const periods = forecastData.properties?.periods || [];
//     if (periods.length === 0) {
//       return {
//         content: [
//           {
//             type: "text",
//             text: "No forecast periods available",
//           },
//         ],
//       };
//     }

//     // Format forecast periods
//     const formattedForecast = periods.map((period: ForecastPeriod) =>
//       [
//         `${period.name || "Unknown"}:`,
//         `Temperature: ${period.temperature || "Unknown"}°${period.temperatureUnit || "F"}`,
//         `Wind: ${period.windSpeed || "Unknown"} ${period.windDirection || ""}`,
//         `${period.shortForecast || "No forecast available"}`,
//         "---",
//       ].join("\n"),
//     );

//     const forecastText = `Forecast for ${latitude}, ${longitude}:\n\n${formattedForecast.join("\n")}`;

//     return {
//       content: [
//         {
//           type: "text",
//           text: forecastText,
//         },
//       ],
//     };
//   },
// );

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
        portfolio.groupTokens.forEach((group, groupIndex) => {
          output += `\nGroup ${groupIndex + 1}: ${group.name} (${group.symbol})\n`;
          output += `  Group Token Address : ${group.tokenAddress}\n`;
          output += `  Balance             : ${group.balance}\n`;
          output += `  Network             : ${group.networkName}\n`;
          output += `  Sub Tokens:\n`;
          if (group.tokens.length > 0) {
            group.tokens.forEach((token, tokenIndex) => {
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
        account.forEach((wallet, index) => {
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
            'http://localhost:3000/oauth2callback'
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
    server.listen(3000);

    return new Promise<void>((resolve, reject) => {
        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: ['profile', 'email'],
        });

        console.log('Please visit this URL to authenticate:', authUrl);
        open(authUrl);

        server.on('request', async (req, res) => {
            if (!req.url?.startsWith('/oauth2callback')) return;

            const url = new URL(req.url, 'http://localhost:3000');
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
    console.error("No id_token found");
    return;
  }

  try {
    const user = await oktoClient.loginUsingOAuth({
      idToken: oauth2Client.credentials.id_token, 
      provider: 'google',
    })
  } catch (error) {
    console.error("Okto Authentication failed:", error);
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

  // console.log("id_token", oauth2Client.credentials.id_token);
  await oktoAuthenticate();

  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.error("Okto MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
