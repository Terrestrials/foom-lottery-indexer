# FOOM Lottery Indexer

A comprehensive blockchain indexer and API service for the FOOM.Cash decentralized lottery system. This NestJS-based application indexes lottery events, manages Merkle tree operations, and provides real-time statistics for the anonymous lottery platform.

## 🎰 Overview

FOOM.Cash is a fully decentralized, anonymous lottery system built on Ethereum and Base networks. This indexer service:

- **Indexes blockchain events** from the FoomLottery smart contracts
- **Manages Merkle tree operations** for privacy-preserving lottery mechanics
- **Provides REST API endpoints** for lottery data and statistics
- **Handles real-time notifications** via Telegram bot integration
- **Synchronizes lottery data** across multiple blockchain networks
- **Calculates reward statistics** and APR for participants

## 🏗️ Architecture

### Core Components

- **Lottery Service**: Manages lottery operations, Merkle tree interactions, and bet tracking
- **Blockchain Service**: Handles smart contract interactions and event monitoring
- **Database Service**: MongoDB integration for persistent data storage
- **API Service**: RESTful endpoints for external integrations
- **FOOM Cash Bot**: Telegram bot for lottery notifications and statistics
- **Event System**: Real-time event processing for lottery activities

### Key Features

- 🔒 **Privacy-First**: Zero-knowledge proof support with MiMC hash functions
- 🌐 **Multi-Chain**: Supports Ethereum mainnet and Base network
- 📊 **Real-Time Stats**: Live lottery statistics and reward calculations
- 🤖 **Bot Integration**: Automated Telegram notifications for wins and updates
- 🔄 **Data Sync**: Automatic synchronization with foom.cash data sources
- 📈 **APR Tracking**: Historical and current APR calculations for investors

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MongoDB
- Redis
- Docker (optional)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd foom-lottery-indexer

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev
```

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
# Database
DATABASE_URI=mongodb://localhost:27017/foom-lottery
DATABASE_AUTH_URI=/path/to/cert.pem

# Redis
REDIS_URL=redis://localhost:6379

# Blockchain RPC endpoints
RPC_URL_ETH=https://eth.llamarpc.com
RPC_URL_BASE=https://mainnet.base.org

# Telegram Bot (optional)
FOOM_CASH_BOT_TOKEN=your-telegram-bot-token
FOOM_CASH_BOT_CHANNEL=@your-channel

# Session & Security
SESSION_SECRET=your-session-secret

# Environment flags
IS_ETH=false  # true for Ethereum, false for Base
IS_STAGING=false
NODE_ENV=development
```

## 📚 API Documentation

### Core Endpoints

#### Lottery Operations
- `GET /v1/lottery/last-leaf` - Get the latest Merkle tree leaf
- `GET /v1/lottery/proof-path?index=123` - Get Merkle proof for a leaf
- `GET /v1/lottery/leaf?hash=0x...` - Find leaf by hash
- `GET /v1/lottery/plays` - Get paginated lottery plays
- `GET /v1/lottery/reward-stats` - Get current reward statistics

#### Statistics & Monitoring
- `GET /v1/lottery/round-time` - Current round time information
- `GET /v1/lottery/fees` - Current lottery fees
- `GET /v1/lottery/logs` - Paginated lottery event logs

#### Bot Integration
- `GET /v1/foom-cash-bot/stats` - Get bot statistics
- `POST /v1/foom-cash-bot/stats` - Trigger manual stats posting

### Response Examples

```typescript
// GET /v1/lottery/reward-stats
{
  "foomBalanceM": 1.5,              // FOOM balance in millions
  "totalTickets": 156789,           // Total tickets issued
  "periods": [...],                 // Historical period data
  "periodInfo": {
    "currentPeriod": 42,
    "timeRemaining": 3600,
    "apr": 12.5
  }
}

// GET /v1/lottery/plays
{
  "data": [...],                    // Array of lottery plays
  "page": 1,
  "pages": 10,
  "total": 100
}
```

## 🛠️ Development

### Project Structure

```
src/
├── lib/                    # Core library functions
│   ├── contracts/          # Smart contract ABIs and addresses
│   ├── lottery/            # Lottery-specific utilities
│   └── utils/              # General utilities
├── modules/                # NestJS modules
│   ├── api/                # External API integrations
│   ├── blockchain/         # Blockchain interactions
│   ├── core/               # Core application logic
│   ├── database/           # Database configurations
│   ├── foom-cash-bot/      # Telegram bot service
│   └── lottery/            # Lottery service logic
├── schemas/                # MongoDB schemas
└── utils/                  # Utility functions
```

### Key Technologies

- **NestJS**: Application framework
- **MongoDB**: Document database with Mongoose ODM
- **Redis**: Caching and session storage
- **Viem**: Ethereum client library
- **Socket.IO**: Real-time communication
- **Telegram Bot API**: Notification system

### Development Commands

```bash
# Development server with hot reload
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint and format code
npm run lint
npm run format

# Debug mode
npm run start:debug
```

## 📡 Event Processing

The indexer processes various lottery events:

- **BetIn**: New lottery entries
- **Win**: Lottery winners and payouts
- **Update**: Tree state updates
- **Cancel**: Bet cancellations

Events are processed in real-time and stored in MongoDB for historical analysis.

## 🔐 Security Features

- **Zero-Knowledge Proofs**: Privacy-preserving lottery mechanics
- **MiMC Hashing**: Cryptographically secure hash functions
- **Merkle Trees**: Efficient proof verification
- **Session Management**: Secure user sessions with MongoDB store
- **CORS Protection**: Configurable cross-origin resource sharing

## 🌍 Multi-Chain Support

Supports both Ethereum mainnet and Base network:

- Switch between chains using `IS_ETH` environment variable
- Automatic contract address resolution per chain
- Chain-specific RPC configuration
- Independent data synchronization per network

## 📊 Monitoring & Analytics

- **Real-time Statistics**: APR, total value locked, active players
- **Performance Metrics**: Transaction processing times, success rates
- **Health Checks**: Service availability and database connectivity
- **Telegram Notifications**: Automated win announcements and daily stats

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection**: Ensure MongoDB is running and URI is correct
2. **RPC Errors**: Verify RPC endpoints are accessible and have sufficient rate limits
3. **Memory Issues**: Monitor heap usage during Merkle tree operations
4. **Sync Problems**: Check foom.cash connectivity for data synchronization

### Logging

The application uses structured logging with different levels:
- `_log()` for general information
- `_warn()` for warnings and recoverable errors
- Error objects for critical failures

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under UNLICENSED - see the package.json for details.

## 🔗 Related Links

- [FOOM.Cash Website](https://foom.cash)
- [Smart Contracts](https://etherscan.io/address/0x239AF915abcD0a5DCB8566e863088423831951f8)
- [Base Contract](https://basescan.org/address/0xdb203504ba1fea79164AF3CeFFBA88C59Ee8aAfD)
