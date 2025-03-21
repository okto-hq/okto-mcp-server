# Okto Web3 MCP Server

A Model Context Protocol (MCP) server for Okto Web3 integration in Claude Desktop with auto authentication support. This server enables AI assistants to manage Web3 transactions and portfolio through natural language interactions.

## Features

- View portfolio details including holdings and balances
- Get account information across multiple chains
- View NFT collections and portfolio
- Check transaction history
- Transfer tokens between addresses
- Support for multiple blockchain networks
- View supported chains and tokens
- Simple OAuth2 authentication flow with auto browser launch
- Support for both Desktop and Web application credentials
- Global credential storage for convenience

## Installation & Authentication

### Installing Manually
1. Create a Google Cloud Project and obtain credentials:

   a. Create a Google Cloud Project:
      - Go to [Google Cloud Console](https://console.cloud.google.com/)
      - Create a new project or select an existing one
      - Enable the necessary OAuth scopes for your project

   b. Create OAuth 2.0 Credentials:
      - Go to "APIs & Services" > "Credentials"
      - Click "Create Credentials" > "OAuth client ID"
      - Choose either "Desktop app" or "Web application" as application type
      - Give it a name and click "Create"
      - For Web application, add `http://localhost:3000/oauth2callback` to the authorized redirect URIs
      - Download the JSON file of your client's OAuth keys
      - Rename the key file to `gcp-oauth.keys.json`

2. Set up Okto credentials:

   Get these Okto credentials from https://dashboard.okto.tech/:
   ```
   OKTO_ENVIRONMENT=sandbox
   OKTO_CLIENT_PRIVATE_KEY=your_private_key
   OKTO_CLIENT_SWA=your_swa
   ```

3. Run Authentication:

   You can authenticate in two ways:

   a. Global Authentication (Recommended):
   ```bash
   # First time: Place gcp-oauth.keys.json in your home directory's .okto-mcp folder
   mkdir -p ~/.okto-mcp
   mv gcp-oauth.keys.json ~/.okto-mcp/

   # Run authentication from anywhere
   npx @okto_web3/okto-mcp-server@latest auth
   ```

   b. Local Authentication:
   ```bash
   # Place gcp-oauth.keys.json in your current directory
   # The file will be automatically copied to global config
   npx @okto_web3/okto-mcp-server@latest auth
   ```

   The authentication process will:
   - Look for `gcp-oauth.keys.json` in the current directory or `~/.okto-mcp/`
   - If found in current directory, copy it to `~/.okto-mcp/`
   - Open your default browser for Google authentication
   - Save credentials as `~/.okto-mcp/credentials.json`

   > **Note**: 
   > - After successful authentication, credentials are stored globally in `~/.okto-mcp/` and can be used from any directory
   > - Both Desktop app and Web application credentials are supported
   > - For Web application credentials, make sure to add `http://localhost:3000/oauth2callback` to your authorized redirect URIs

## Claude Desktop Configuration

Add the following to your Claude Desktop configuration file (typically located at `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "okto": {
      "command": "node",
      "env": {
        "OKTO_ENVIRONMENT": "sandbox",
        "OKTO_CLIENT_PRIVATE_KEY": "your_private_key_here",
        "OKTO_CLIENT_SWA": "your_swa_here"
      },
      "args": [
        "/path/to/okto-mcp-server/build/index.js"
      ]
    }
  }
}
```

Replace:
- `your_private_key_here` with your Okto client private key
- `your_swa_here` with your Okto client SWA
- `/path/to/okto-mcp-server` with the actual path where you installed the server

Alternatively, if you installed via npm:

```json
{
  "mcpServers": {
    "okto": {
      "command": "npx",
      "env": {
        "OKTO_ENVIRONMENT": "sandbox",
        "OKTO_CLIENT_PRIVATE_KEY": "your_private_key_here",
        "OKTO_CLIENT_SWA": "your_swa_here"
      },
      "args": [
        "@okto_web3/okto-mcp-server@latest"
      ]
    }
  }
}
```

## Available Tools

The server provides the following tools that can be used through Claude Desktop:

### 1. Get Portfolio (`get-portfolio`)
Retrieves detailed portfolio information including holdings and balances.

<!-- ```json
{}
``` -->

### 2. Get Account (`get-account`)
Retrieves account details across multiple chains.

<!-- ```json
{}
``` -->

### 3. Get NFT Collections (`get-nft-collections`)
Lists all NFT collections associated with the account.
<!-- 
```json
{}
``` -->

### 4. Get Orders History (`get-orders-history`)
Retrieves transaction history.

<!-- ```json
{}
``` -->

### 5. Get NFT Portfolio (`get-nft-portfolio`)
Shows detailed NFT holdings information.

<!-- ```json
{}
``` -->

### 6. Get Tokens (`get-tokens`)
Lists all available tokens and their details.

<!-- ```json
{}
``` -->

### 7. Token Transfer (`token-transfer`)
Transfers tokens between addresses.

```json
{
  "amount": "1000000000000000000",
  "recipient": "0x...",
  "token": "0x...",
  "caip2Id": "eip155:1"
}
```

### 8. Get Chains (`get-chains`)
Lists all supported blockchain networks.

<!-- ```json
{}
``` -->



## Security Notes

- OAuth credentials are stored securely in your local environment (`~/.okto-mcp/`)
- The server uses offline access to maintain persistent authentication
- Never share or commit your credentials to version control
- Regularly review and revoke unused access in your Google Account settings
- Okto credentials should be stored securely in environment variables
- Credentials are stored globally but are only accessible by the current user

## Troubleshooting

1. **OAuth Keys Not Found**
   - Make sure `gcp-oauth.keys.json` is in either your current directory or `~/.okto-mcp/`
   - Check file permissions

2. **Invalid Credentials Format**
   - Ensure your OAuth keys file contains either `web` or `installed` credentials
   - For web applications, verify the redirect URI is correctly configured

3. **Port Already in Use**
   - If port 3000 is already in use, please free it up before running authentication
   - You can find and stop the process using that port

4. **Okto Authentication Failed**
   - Verify your environment variables are set correctly
   - Check that your Okto credentials are valid
   - Ensure you're using the correct environment (sandbox/production)

## License

ISC

## Support

If you encounter any issues or have questions, please file an issue on the GitHub repository.
