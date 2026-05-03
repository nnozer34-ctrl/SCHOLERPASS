import { uploadToIpfs } from "./lib/ipfs";

export const uploadToIPFS = async (file) => {
  const result = await uploadToIpfs(file);
  return result.cid;
};
