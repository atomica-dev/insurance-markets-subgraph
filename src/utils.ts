import { BigInt } from "@graphprotocol/graph-ts";

export const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const WEI_BIGINT = BigInt.fromI32(1000000000).times(
  BigInt.fromI32(1000000000)
);

export function filterNotEqual(array: string[], item: string): string[] {
  let res: string[] = [];

  for (let i = 0; i < array.length; i++) {
    if (array[i] != item) {
      res.push(array[i]);
    }
  }

  return res;
}

export function addUniqueToList<T>(list: T[], item: T): T[] {
  if (list.indexOf(item) < 0) {
    return addToList(list, item);
  }

  return list;
}

export function addToList<T>(list: T[], item: T): T[] {
  list.push(item);

  return list;
}