import { ethers } from 'ethers';

export const BSC_RPC_URL = 'https://bsc-dataseed.binance.org/';
export const SNR_VAULT_ADDRESS = '0x5Ce1427F77D8c58F97f5e18b36804fD54Aa72718';

// Minimal ABI for ERC20 balanceOf and name/symbol
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function transfer(address to, uint amount) returns (bool)"
];

export async function getWalletBalance(address: string): Promise<number> {
  try {
    const provider = new ethers.JsonRpcProvider(BSC_RPC_URL);
    const contract = new ethers.Contract(SNR_VAULT_ADDRESS, ERC20_ABI, provider);
    
    const balance = await contract.balanceOf(address);
    const decimals = await contract.decimals();
    
    // Convert BigInt to readable number based on decimals
    return Number(ethers.formatUnits(balance, decimals));
  } catch (error) {
    console.error('Error fetching BSC balance:', error);
    return 0;
  }
}

export async function transferTokens(to: string, amount: number) {
  if (typeof window === 'undefined' || !(window as any).ethereum) {
    throw new Error('Wallet tidak terdeteksi');
  }

  try {
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(SNR_VAULT_ADDRESS, ERC20_ABI, signer);
    
    const decimals = await contract.decimals();
    const amountInUnits = ethers.parseUnits(amount.toString(), decimals);
    
    // Execute the transfer
    const tx = await contract.transfer(to, amountInUnits);
    
    // Wait for 1 confirmation
    const receipt = await tx.wait();
    return receipt.hash;
  } catch (error: any) {
    console.error('Transfer failed:', error);
    if (error.code === 'ACTION_REJECTED') {
      throw new Error('Transaksi ditolak oleh pengguna');
    }
    throw new Error(error.reason || error.message || 'Transfer gagal');
  }
}

export async function connectWallet() {
  if (typeof window !== 'undefined' && (window as any).ethereum) {
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      // Request account access
      const accounts = await provider.send("eth_requestAccounts", []);
      
      // Check if it's BSC (Chain ID 56)
      const network = await provider.getNetwork();
      if (network.chainId !== BigInt(56)) {
        try {
          await (window as any).ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x38' }], // 56 in hex
          });
        } catch (switchError: any) {
          // This error code indicates that the chain has not been added to MetaMask/TokenPocket.
          if (switchError.code === 4902) {
            await (window as any).ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: '0x38',
                  chainName: 'Binance Smart Chain',
                  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
                  rpcUrls: [BSC_RPC_URL],
                  blockExplorerUrls: ['https://bscscan.com/'],
                },
              ],
            });
          } else {
            throw switchError;
          }
        }
      }
      
      return accounts[0];
    } catch (error) {
      console.error('Wallet connection failed:', error);
      throw error;
    }
  } else {
    throw new Error('No Web3 wallet detected (TokenPocket/MetaMask)');
  }
}
