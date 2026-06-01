export function isAdminWallet(wallet?: string | null) {
  if (!wallet) return false;
  const admins = (process.env.NEXT_PUBLIC_ADMIN_WALLETS || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  return admins.includes(wallet.toLowerCase());
}
