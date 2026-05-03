import { uploadToIpfs } from "./lib/ipfs";

export const uploadToIPFS = async (file: File) => {
  const result = await uploadToIpfs(file);
  return result.cid;
};
