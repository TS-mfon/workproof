export async function uploadSpec(file: File) {
  const token = process.env.NEXT_PUBLIC_WEB3_STORAGE_TOKEN || process.env.WEB3_STORAGE_TOKEN;
  if (!token) {
    throw new Error("WEB3_STORAGE_TOKEN is required for IPFS uploads");
  }
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("https://api.web3.storage/upload", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: form
  });
  if (!response.ok) throw new Error(`IPFS upload failed: ${response.status}`);
  const body = await response.json();
  return `ipfs://${body.cid}`;
}
