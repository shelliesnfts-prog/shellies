# Shellies Raffles

🌐 **Website**: [https://www.shellies.xyz/](https://www.shellies.xyz/)  
🐦 **X (Twitter)**: [@Shellies_NFTs](https://x.com/Shellies_NFTs)

A decentralized raffle and gaming platform built for Shellies NFT holders on the Ink blockchain. Users can earn XP through gaming, convert it to points, and participate in raffles to win NFTs and ERC20 tokens.

## Overview

Shellies Raffles is a Next.js 15 application that combines gaming, NFT utilities, and raffle participation. Built specifically for the Shellies NFT community, it features blockchain integration for secure raffle management, prize distribution, and a play-to-earn gaming experience with the Shellies Mario Game.

## Key Features

### 🎮 Gaming & Rewards
- **Shellies Mario Game**: Play a custom Mario-style platformer game to earn XP
- **XP to Points Conversion**: Convert earned XP to raffle points with a secure payment system (1000 XP = 100 points for 0.1 USD)
- **Payment Recovery**: Automatic recovery mechanism for interrupted conversions - never lose your payment
- **Mobile Optimized**: Responsive game interface with 60vh viewport height for mobile devices

### 🎟️ Raffle System
- **Point-Based Participation**: Use earned points to purchase raffle tickets
- **Multi-Prize Support**: Raffles can feature NFT or ERC20 token prizes
- **Blockchain Integration**: Smart contracts handle raffle creation, participation, and winner selection
- **Fair Winner Selection**: Transparent on-chain randomness for winner determination

### 💎 NFT Holder Benefits
- **Tiered Pricing System**: Three payment tiers with automatic detection
  - **Regular Users**: Standard pricing (0.00001 ETH)
  - **NFT Holders**: 50% discount (0.000005 ETH) - requires at least 1 Shellies NFT
  - **Stakers**: 80% discount (0.000002 ETH) - requires at least 1 staked NFT
- **Staking System**: Stake NFTs for maximum benefits and discounts
- **Automatic Tier Detection**: System automatically applies the best available discount

### 🎨 User Experience
- **Futuristic UI**: Cyberpunk-themed design with glassmorphism effects and animations
- **Responsive Design**: Fully optimized for desktop, tablet, and mobile devices
- **Dark/Light Mode**: Theme switching support throughout the application
- **Smooth Animations**: Framer Motion powered transitions and interactions

## Smart Contracts

The platform integrates with three main smart contracts on the Ink blockchain (Chain ID: 57073):

### Raffle Contract
- **Purpose**: Manages the complete raffle lifecycle from creation to prize distribution
- **Key Functions**:
  - `createAndActivateNFTRaffle()` - Creates raffles with NFT prizes
  - `createAndActivateTokenRaffle()` - Creates raffles with ERC20 token prizes
  - `endRaffle()` - Concludes raffles and selects winners
  - `getRaffleInfo()` - Retrieves raffle details and status
- **Features**: Role-based access control, emergency withdrawal, pausable functionality

### Staking Contract
- **Purpose**: Allows Shellies NFT holders to stake their tokens with time-lock periods
- **Key Functions**:
  - `stake()` / `stakeBatch()` - Stake single or multiple NFTs
  - `unstake()` / `unstakeBatch()` - Unstake tokens after lock period
  - `canUnstake()` - Check if tokens can be unstaked
  - `getStakedTokens()` - View user's staked NFTs
- **Features**: Multiple lock periods (day, week, month), emergency unstaking

### Game Payment Contract
- **Purpose**: Handles payments for game sessions and XP conversions
- **Key Functions**:
  - `payToPlay()` - Process payment to start a game session
  - `payToConvertXP()` - Process payment for XP to points conversion
  - `withdraw()` - Admin function to withdraw collected funds
- **Features**: Secure payment processing, event emission for tracking, admin-only withdrawals

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS v4
- **Blockchain**: Wagmi, Viem, RainbowKit for Web3 integration
- **Authentication**: NextAuth with SIWE (Sign-In With Ethereum)
- **Database**: Supabase (PostgreSQL)
- **Animations**: Framer Motion, GSAP, Three.js
- **Testing**: Jest
- **Web3 Libraries**: ethers.js, viem for blockchain interactions

## Recent Updates & Features

### 🎮 Gaming System 
- **Shellies Mario Game**: Custom platformer game with XP rewards
- **Mobile Optimization**: 60vh viewport height, responsive design, horizontal scroll fix
- **Game Controls**: Desktop-only keyboard controls display
- **Play-to-Earn**: Earn XP by playing, convert to raffle points

### 💰 XP Conversion System 
- **Payment-Based Conversion**: Convert earned XP to raffle points
- **Secure Processing**: Blockchain-verified transactions
- **Payment Recovery**: Automatic recovery for interrupted conversions

### 🎯 Tiered Pricing System 
- **Three-Tier Structure**: Regular, NFT Holder, Staker
- **Automatic Detection**: System checks staking status and NFT ownership
- **Dynamic Discounts**: Up to 80% discount for stakers
- **Database-Driven**: Easy price updates without contract changes
- **Admin Management**: Update tier pricing through admin dashboard

### 🔐 Session Management 
- **Persistent Sessions**: Secure session management with automatic refresh
- **Auto-Reconnection**: Wallet reconnects automatically on page reload
- **Address Monitoring**: Detects wallet switches and disconnections

### 🎨 UI/UX Improvements 
- **Homepage Redesign**: Futuristic cyberpunk theme with glassmorphism
- **Fire Animations**: Active tier badges with animated effects
- **NFT Analytics**: Display NFT count and staking status on game page
- **Payment Banners**: Informative banners with localStorage persistence
- **Mobile Responsive**: Optimized layouts for all screen sizes

### 📊 Admin Features
- **Tier Management**: Update payment amounts for all tiers
- **Contract Withdrawals**: Secure fund management interface
- **Raffle Management**: Complete lifecycle management
- **Analytics Dashboard**: Monitor platform metrics

## Database

The platform uses Supabase (PostgreSQL) for data management, storing user profiles, raffle information, game sessions, and tier configurations.

## Getting Started

Visit [https://www.shellies.xyz/](https://www.shellies.xyz/) to start playing and earning rewards!

### For Developers

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables

3. Run the development server:
```bash
npm run dev
```

## Development Commands

- `npm run dev` - Start development server
- `npm run build` - Build production application
- `npm start` - Start production server
- `npm test` - Run Jest tests



## Project Structure

```
src/
├── app/                          # Next.js app router
│   ├── api/                      # API routes
│   ├── admin/                    # Admin dashboard pages
│   ├── game/                     # Game page
│   ├── portal/                   # Protected portal pages
│   └── page.tsx                  # Homepage
├── components/                   # React components
├── hooks/                        # Custom React hooks
├── lib/                          # Core utilities and services
├── public/
│   └── mario-game-v2/           # Game assets
└── styles/                       # Global styles
```

## How It Works

### Gaming Flow
```
Connect wallet → Pay to play → Earn XP in game → Convert XP to points → Use points for raffles
```

### Payment Tiers
The system automatically detects your tier based on NFT ownership and applies the appropriate discount.

## Troubleshooting

### Common Issues

#### Wallet Not Connecting
- Ensure your wallet extension is unlocked
- Check that you're on the Ink blockchain (Chain ID: 57073)
- Clear browser cache and localStorage
- Try a different wallet connector

#### Session Expired
- If expired, simply reconnect your wallet
- Check that cookies are enabled in your browser

#### Payment Not Processing
- Verify you have sufficient ETH for gas fees
- Check transaction status on blockchain explorer
- If interrupted, the system will show a "Resume Conversion" button
- Contact support if payment was successful but conversion didn't complete

#### Wrong Tier Detected
- Refresh the page to re-check NFT ownership
- Check staking contract for staked NFTs
- Clear cache and reconnect wallet

#### Game Not Loading
- Check browser console for errors
- Ensure JavaScript is enabled
- Try a different browser (Chrome, Firefox, Brave recommended)
- On mobile, use landscape orientation for better experience



## Security Best Practices

### For Users
- Never share your private keys or seed phrase
- Always verify transaction details before signing
- Use hardware wallets for large holdings
- Check contract addresses before interacting
- Be cautious of phishing attempts

### For Developers
- All API routes validate wallet signatures
- Server-side verification for all transactions
- Secure session management
- Admin functions require role-based access control

## Contributing

We welcome contributions! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Write tests for new features
- Update documentation for API changes
- Use conventional commit messages
- Ensure all tests pass before submitting

## Testing

### Run All Tests
```bash
npm test
```

### Test Specific Features
```bash
# Points calculation
npm run test:points

# Watch mode for development
npm run test:watch
```

### Manual Testing Checklist
- [ ] Wallet connection and disconnection
- [ ] Session persistence across page reloads
- [ ] Game payment with all three tiers
- [ ] XP earning and conversion
- [ ] Payment recovery mechanism
- [ ] Raffle participation
- [ ] NFT staking and unstaking
- [ ] Admin dashboard functions
- [ ] Mobile responsiveness

## Deployment

### Build for Production
```bash
npm run build
npm start
```

## Performance Optimization

- **Code Splitting**: Next.js automatic code splitting
- **Image Optimization**: Next.js Image component
- **Caching**: React Query for data caching
- **Lazy Loading**: Components loaded on demand
- **Bundle Size**: Optimized with tree shaking

## Browser Support

- Chrome/Edge (Chromium) - ✅ Fully supported
- Firefox - ✅ Fully supported
- Safari - ✅ Fully supported
- Brave - ✅ Fully supported
- Mobile browsers - ✅ Optimized for mobile

## License

This project is proprietary software. All rights reserved.

## Support & Contact

- **Website**: [https://www.shellies.xyz/](https://www.shellies.xyz/)
- **X (Twitter)**: [@Shellies_NFTs](https://x.com/Shellies_NFTs)
- **Discord**: Join our community for support and updates

## Acknowledgments

- Built with Next.js 15 and React 19
- Powered by Wagmi and RainbowKit for Web3 integration
- Styled with Tailwind CSS v4
- Animated with Framer Motion
- Deployed on the Ink blockchain

---

**Version**: 2.0.0  
**Last Updated**: November 2024  
**Status**: ✅ Production Ready

Made with ❤️ by the Shellies team
