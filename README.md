# Exeos Auto Bot

Automated bot for ExeOS network to manage extension connections and liveness checks. This tool helps users maintain their connection to the ExeOS network and maximize rewards.

## Features

- Automatic connection to ExeOS network
- Regular liveness checks to maintain connectivity
- Support for multiple accounts
- Proxy support (HTTP, HTTPS, SOCKS4, SOCKS5)
- Detailed logging and statistics
- Real-time display of earnings and connected nodes

## Requirements

- Node.js (v14 or higher)
- ExeOS account token
- ExeOS extension ID

## Installation

1. Clone the repository:
```bash
git clone https://github.com/airdropinsiders/Exeos-Auto-Bot.git
cd Exeos-Auto-Bot
```

2. Install dependencies:
```bash
npm install
```

3. Set up your configuration files:
   - Create a `token.txt` file with your ExeOS account token (one per line)
   - Create an `id.txt` file with your ExeOS extension ID (one per line)
   - (Optional) Create a `proxies.txt` file with proxy URLs (one per line)

## Configuration Files Format

### token.txt
```
your_exeos_token_here
another_token_if_needed
```

### id.txt
```
your_extension_id_here
another_extension_id_if_needed
```

### proxies.txt (Optional)
```
http://username:password@host:port
socks5://username:password@host:port
```

## Usage

Start the bot:
```bash
npm run start
```

The bot will automatically:
1. Connect your extensions to the ExeOS network
2. Perform regular liveness checks
3. Track and display your points and earnings
4. Log all activities to `exeos-bot.log`

## Statistics Display

The bot displays real-time statistics including:
- Total earnings
- Referral points
- Connected node rewards
- Uptime
- Connection and liveness check counts

## Troubleshooting

If you encounter any issues:
1. Check the `exeos-bot.log` file for detailed error messages
2. Verify your token and extension ID are correct
3. If using proxies, ensure they are properly formatted and working

## Disclaimer

This tool is provided for educational purposes only. Use at your own risk.

## License

MIT License

## Support

For support, join our community:
- [Telegram](https://t.me/AirdropInsiderID)

---

Created by [Airdrop Insiders](https://github.com/airdropinsiders)