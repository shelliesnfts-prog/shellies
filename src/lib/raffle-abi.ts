export const raffle_abi = [
			{
				"inputs": [
					{
						"internalType": "address",
						"name": "serverWallet",
						"type": "address"
					}
				],
				"stateMutability": "nonpayable",
				"type": "constructor"
			},
			{
				"inputs": [],
				"name": "AccessControlBadConfirmation",
				"type": "error"
			},
			{
				"inputs": [
					{
						"internalType": "address",
						"name": "account",
						"type": "address"
					},
					{
						"internalType": "bytes32",
						"name": "neededRole",
						"type": "bytes32"
					}
				],
				"name": "AccessControlUnauthorizedAccount",
				"type": "error"
			},
			{
				"anonymous": false,
				"inputs": [
					{
						"indexed": true,
						"internalType": "uint256",
						"name": "raffleId",
						"type": "uint256"
					},
					{
						"indexed": true,
						"internalType": "address",
						"name": "admin",
						"type": "address"
					},
					{
						"indexed": false,
						"internalType": "address",
						"name": "prizeToken",
						"type": "address"
					},
					{
						"indexed": false,
						"internalType": "uint256",
						"name": "prizeTokenId",
						"type": "uint256"
					}
				],
				"name": "EmergencyWithdraw",
				"type": "event"
			},
			{
				"anonymous": false,
				"inputs": [
					{
						"indexed": false,
						"internalType": "address",
						"name": "account",
						"type": "address"
					}
				],
				"name": "Paused",
				"type": "event"
			},
			{
				"anonymous": false,
				"inputs": [
					{
						"indexed": true,
						"internalType": "uint256",
						"name": "raffleId",
						"type": "uint256"
					},
					{
						"indexed": true,
						"internalType": "address",
						"name": "prizeToken",
						"type": "address"
					},
					{
						"indexed": false,
						"internalType": "uint256",
						"name": "prizeTokenId",
						"type": "uint256"
					},
					{
						"indexed": false,
						"internalType": "bool",
						"name": "isNFT",
						"type": "bool"
					}
				],
				"name": "RaffleCreated",
				"type": "event"
			},
			{
				"anonymous": false,
				"inputs": [
					{
						"indexed": true,
						"internalType": "uint256",
						"name": "raffleId",
						"type": "uint256"
					},
					{
						"indexed": true,
						"internalType": "address",
						"name": "winner",
						"type": "address"
					},
					{
						"indexed": false,
						"internalType": "uint256",
						"name": "totalParticipants",
						"type": "uint256"
					},
					{
						"indexed": false,
						"internalType": "uint256",
						"name": "totalTickets",
						"type": "uint256"
					}
				],
				"name": "RaffleEnded",
				"type": "event"
			},
			{
				"anonymous": false,
				"inputs": [
					{
						"indexed": true,
						"internalType": "uint256",
						"name": "raffleId",
						"type": "uint256"
					},
					{
						"indexed": false,
						"internalType": "enum ShelliesRaffleContract.RaffleState",
						"name": "oldState",
						"type": "uint8"
					},
					{
						"indexed": false,
						"internalType": "enum ShelliesRaffleContract.RaffleState",
						"name": "newState",
						"type": "uint8"
					}
				],
				"name": "RaffleStateChanged",
				"type": "event"
			},
			{
				"anonymous": false,
				"inputs": [
					{
						"indexed": true,
						"internalType": "bytes32",
						"name": "role",
						"type": "bytes32"
					},
					{
						"indexed": true,
						"internalType": "bytes32",
						"name": "previousAdminRole",
						"type": "bytes32"
					},
					{
						"indexed": true,
						"internalType": "bytes32",
						"name": "newAdminRole",
						"type": "bytes32"
					}
				],
				"name": "RoleAdminChanged",
				"type": "event"
			},
			{
				"anonymous": false,
				"inputs": [
					{
						"indexed": true,
						"internalType": "bytes32",
						"name": "role",
						"type": "bytes32"
					},
					{
						"indexed": true,
						"internalType": "address",
						"name": "account",
						"type": "address"
					},
					{
						"indexed": true,
						"internalType": "address",
						"name": "sender",
						"type": "address"
					}
				],
				"name": "RoleGranted",
				"type": "event"
			},
			{
				"anonymous": false,
				"inputs": [
					{
						"indexed": true,
						"internalType": "bytes32",
						"name": "role",
						"type": "bytes32"
					},
					{
						"indexed": true,
						"internalType": "address",
						"name": "account",
						"type": "address"
					},
					{
						"indexed": true,
						"internalType": "address",
						"name": "sender",
						"type": "address"
					}
				],
				"name": "RoleRevoked",
				"type": "event"
			},
			{
				"anonymous": false,
				"inputs": [
					{
						"indexed": false,
						"internalType": "address",
						"name": "account",
						"type": "address"
					}
				],
				"name": "Unpaused",
				"type": "event"
			},
			{
				"inputs": [],
				"name": "ADMIN_ROLE",
				"outputs": [
					{
						"internalType": "bytes32",
						"name": "",
						"type": "bytes32"
					}
				],
				"stateMutability": "view",
				"type": "function"
			},
			{
				"inputs": [],
				"name": "DEFAULT_ADMIN_ROLE",
				"outputs": [
					{
						"internalType": "bytes32",
						"name": "",
						"type": "bytes32"
					}
				],
				"stateMutability": "view",
				"type": "function"
			},
			{
				"inputs": [],
				"name": "SERVER_ROLE",
				"outputs": [
					{
						"internalType": "bytes32",
						"name": "",
						"type": "bytes32"
					}
				],
				"stateMutability": "view",
				"type": "function"
			},
			{
				"inputs": [
					{
						"internalType": "uint256",
						"name": "raffleId",
						"type": "uint256"
					}
				],
				"name": "activateRaffle",
				"outputs": [],
				"stateMutability": "nonpayable",
				"type": "function"
			},
			{
				"inputs": [
					{
						"internalType": "address",
						"name": "serverWallet",
						"type": "address"
					}
				],
				"name": "addServerWallet",
				"outputs": [],
				"stateMutability": "nonpayable",
				"type": "function"
			},
			{
				"inputs": [
					{
						"internalType": "uint256",
						"name": "raffleId",
						"type": "uint256"
					}
				],
				"name": "canEndRaffle",
				"outputs": [
					{
						"internalType": "bool",
						"name": "",
						"type": "bool"
					}
				],
				"stateMutability": "view",
				"type": "function"
			},
			{
				"inputs": [
					{
						"internalType": "uint256",
						"name": "raffleId",
						"type": "uint256"
					},
					{
						"internalType": "address",
						"name": "prizeToken",
						"type": "address"
					},
					{
						"internalType": "uint256",
						"name": "tokenId",
						"type": "uint256"
					},
					{
						"internalType": "uint64",
						"name": "endTimestamp",
						"type": "uint64"
					}
				],
				"name": "createRaffleWithNFT",
				"outputs": [],
				"stateMutability": "nonpayable",
				"type": "function"
			},
			{
				"inputs": [
					{
						"internalType": "uint256",
						"name": "raffleId",
						"type": "uint256"
					},
					{
						"internalType": "address",
						"name": "prizeToken",
						"type": "address"
					},
					{
						"internalType": "uint256",
						"name": "amount",
						"type": "uint256"
					},
					{
						"internalType": "uint64",
						"name": "endTimestamp",
						"type": "uint64"
					}
				],
				"name": "createRaffleWithToken",
				"outputs": [],
				"stateMutability": "nonpayable",
				"type": "function"
			},
			{
				"inputs": [
					{
						"internalType": "uint256",
						"name": "raffleId",
						"type": "uint256"
					},
					{
						"internalType": "address",
						"name": "recipient",
						"type": "address"
					}
				],
				"name": "emergencyWithdraw",
				"outputs": [],
				"stateMutability": "nonpayable",
				"type": "function"
			},
			{
				"inputs": [
					{
						"internalType": "uint256",
						"name": "raffleId",
						"type": "uint256"
					},
					{
						"internalType": "address[]",
						"name": "participants",
						"type": "address[]"
					},
					{
						"internalType": "uint256[]",
						"name": "ticketCounts",
						"type": "uint256[]"
					},
					{
						"internalType": "uint256",
						"name": "randomSeed",
						"type": "uint256"
					}
				],
				"name": "endRaffle",
				"outputs": [],
				"stateMutability": "nonpayable",
				"type": "function"
			},
			{
				"inputs": [
					{
						"internalType": "uint256",
						"name": "raffleId",
						"type": "uint256"
					}
				],
				"name": "getRaffleInfo",
				"outputs": [
					{
						"internalType": "address",
						"name": "prizeToken",
						"type": "address"
					},
					{
						"internalType": "uint256",
						"name": "prizeTokenId",
						"type": "uint256"
					},
					{
						"internalType": "uint64",
						"name": "endTimestamp",
						"type": "uint64"
					},
					{
						"internalType": "enum ShelliesRaffleContract.RaffleState",
						"name": "state",
						"type": "uint8"
					},
					{
						"internalType": "bool",
						"name": "isNFT",
						"type": "bool"
					},
					{
						"internalType": "address",
						"name": "winner",
						"type": "address"
					}
				],
				"stateMutability": "view",
				"type": "function"
			},
			{
				"inputs": [
					{
						"internalType": "uint256",
						"name": "raffleId",
						"type": "uint256"
					}
				],
				"name": "getRaffleState",
				"outputs": [
					{
						"internalType": "enum ShelliesRaffleContract.RaffleState",
						"name": "",
						"type": "uint8"
					}
				],
				"stateMutability": "view",
				"type": "function"
			},
			{
				"inputs": [
					{
						"internalType": "bytes32",
						"name": "role",
						"type": "bytes32"
					}
				],
				"name": "getRoleAdmin",
				"outputs": [
					{
						"internalType": "bytes32",
						"name": "",
						"type": "bytes32"
					}
				],
				"stateMutability": "view",
				"type": "function"
			},
			{
				"inputs": [
					{
						"internalType": "bytes32",
						"name": "role",
						"type": "bytes32"
					},
					{
						"internalType": "address",
						"name": "account",
						"type": "address"
					}
				],
				"name": "grantRole",
				"outputs": [],
				"stateMutability": "nonpayable",
				"type": "function"
			},
			{
				"inputs": [
					{
						"internalType": "bytes32",
						"name": "role",
						"type": "bytes32"
					},
					{
						"internalType": "address",
						"name": "account",
						"type": "address"
					}
				],
				"name": "hasRole",
				"outputs": [
					{
						"internalType": "bool",
						"name": "",
						"type": "bool"
					}
				],
				"stateMutability": "view",
				"type": "function"
			},
			{
				"inputs": [
					{
						"internalType": "uint256",
						"name": "raffleId",
						"type": "uint256"
					}
				],
				"name": "isRaffleActive",
				"outputs": [
					{
						"internalType": "bool",
						"name": "",
						"type": "bool"
					}
				],
				"stateMutability": "view",
				"type": "function"
			},
			{
				"inputs": [
					{
						"internalType": "uint256",
						"name": "raffleId",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "ticketCount",
						"type": "uint256"
					}
				],
				"name": "joinRaffle",
				"outputs": [],
				"stateMutability": "nonpayable",
				"type": "function"
			},
			{
				"inputs": [
					{
						"internalType": "address",
						"name": "",
						"type": "address"
					},
					{
						"internalType": "address",
						"name": "",
						"type": "address"
					},
					{
						"internalType": "uint256",
						"name": "",
						"type": "uint256"
					},
					{
						"internalType": "bytes",
						"name": "",
						"type": "bytes"
					}
				],
				"name": "onERC721Received",
				"outputs": [
					{
						"internalType": "bytes4",
						"name": "",
						"type": "bytes4"
					}
				],
				"stateMutability": "nonpayable",
				"type": "function"
			},
			{
				"inputs": [],
				"name": "pause",
				"outputs": [],
				"stateMutability": "nonpayable",
				"type": "function"
			},
			{
				"inputs": [],
				"name": "paused",
				"outputs": [
					{
						"internalType": "bool",
						"name": "",
						"type": "bool"
					}
				],
				"stateMutability": "view",
				"type": "function"
			},
			{
				"inputs": [
					{
						"internalType": "uint256",
						"name": "",
						"type": "uint256"
					}
				],
				"name": "raffles",
				"outputs": [
					{
						"internalType": "address",
						"name": "prizeToken",
						"type": "address"
					},
					{
						"internalType": "uint96",
						"name": "prizeTokenId",
						"type": "uint96"
					},
					{
						"internalType": "uint64",
						"name": "endTimestamp",
						"type": "uint64"
					},
					{
						"internalType": "enum ShelliesRaffleContract.RaffleState",
						"name": "state",
						"type": "uint8"
					},
					{
						"internalType": "bool",
						"name": "isNFT",
						"type": "bool"
					},
					{
						"internalType": "address",
						"name": "winner",
						"type": "address"
					}
				],
				"stateMutability": "view",
				"type": "function"
			},
			{
				"inputs": [
					{
						"internalType": "address",
						"name": "serverWallet",
						"type": "address"
					}
				],
				"name": "removeServerWallet",
				"outputs": [],
				"stateMutability": "nonpayable",
				"type": "function"
			},
			{
				"inputs": [
					{
						"internalType": "bytes32",
						"name": "role",
						"type": "bytes32"
					},
					{
						"internalType": "address",
						"name": "callerConfirmation",
						"type": "address"
					}
				],
				"name": "renounceRole",
				"outputs": [],
				"stateMutability": "nonpayable",
				"type": "function"
			},
			{
				"inputs": [
					{
						"internalType": "bytes32",
						"name": "role",
						"type": "bytes32"
					},
					{
						"internalType": "address",
						"name": "account",
						"type": "address"
					}
				],
				"name": "revokeRole",
				"outputs": [],
				"stateMutability": "nonpayable",
				"type": "function"
			},
			{
				"inputs": [
					{
						"internalType": "bytes4",
						"name": "interfaceId",
						"type": "bytes4"
					}
				],
				"name": "supportsInterface",
				"outputs": [
					{
						"internalType": "bool",
						"name": "",
						"type": "bool"
					}
				],
				"stateMutability": "view",
				"type": "function"
			},
			{
				"inputs": [],
				"name": "unpause",
				"outputs": [],
				"stateMutability": "nonpayable",
				"type": "function"
			}
		] as const;
