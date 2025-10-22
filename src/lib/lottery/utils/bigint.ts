import { randomBytes } from "crypto";

// Generates a random BigInt of specified byte length
const rbigint = (nbytes) => leBufferToBigint(randomBytes(nbytes));

// Converts a hex string value to Bigint.
function hexToBigint(value) {
  if (typeof value === "string") {
    // If it's a hex string
    if (value.startsWith("0x")) {
      return BigInt(value);
    }
    return BigInt("0x" + value);
  }
  // If it's already a number or BigInt
  return BigInt(value);
}

// Converts a Bigint to hex string of specified length
const bigintToHex = (number: bigint | number | string, length = 32) =>
  "0x" + BigInt(`${number}`).toString(16).padStart(length * 2, "0");

export const bigintToHexRaw = (number: bigint | number | string) =>
  "0x" + BigInt(`${number}`).toString(16);

// Converts a buffer of bytes into a BigInt, assuming little-endian byte order.
const leBufferToBigint = (buff) => {
  let res = 0n;
  for (let i = 0; i < buff.length; i++) {
    const n = BigInt(buff[i]);
    res = res + (n << BigInt(i * 8));
  }
  return res;
};

// Converts a BigInt to a little-endian Buffer of specified byte length.
function leBigintToBuffer(num, byteLength) {
  if (num < 0n) throw new Error("BigInt must be non-negative");

  // Validate that byteLength is sufficient to represent the number
  const requiredLength = Math.ceil(num.toString(2).length / 8);
  if (byteLength < requiredLength) {
    throw new Error(
      `The specified byteLength (${byteLength}) is too small to represent the number`
    );
  }

  const buffer = Buffer.alloc(byteLength);

  // Fill the buffer with bytes from BigInt in little-endian order
  for (let i = 0; i < byteLength; i++) {
    buffer[i] = Number(num & 0xffn); // Get the lowest 8 bits
    num >>= 8n; // Shift by 8 bits to the right
  }

  return buffer;
}

// reverese bits
const reverseBits = (num, bitLength) => {
  let res = 0n;
  for (let i = 0; i < bitLength; i++) {
    res = (res << 1n) | (num & 1n);
    num >>= 1n;
  }
  return res;
};

export {
  rbigint,
  hexToBigint,
  bigintToHex,
  leBufferToBigint,
  leBigintToBuffer,
  reverseBits,
};
