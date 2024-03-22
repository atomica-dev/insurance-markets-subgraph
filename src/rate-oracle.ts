import { RateOracle, RateOraclePairRate } from "../generated/schema";
import { RateOracle as RateOracleContract } from "../generated/templates/RateOracle/RateOracle";
import { RateOracle as RateOracleTemplate } from "../generated/templates";
import { ethereum, BigInt, Address, Bytes, dataSource, DataSourceContext, log } from "@graphprotocol/graph-ts";
import { addToList } from "./utils";

const DELAY_BLOCK_COUNT = 10000;

export function isOracleExist(id: string): boolean {
  let oracle = RateOracle.load(id);

  return oracle != null;
}

export function getOracle(id: string): RateOracle {
  let oracle = RateOracle.load(id);

  if (oracle === null) {
    oracle = new RateOracle(id);

    oracle.pairList = [];

    oracle.save();

    let context = new DataSourceContext();

    context.setString("oracleAddress", id);

    RateOracleTemplate.createWithContext(Address.fromString(id), context);
  }

  return oracle;
}

export function getPairId(from: Bytes, to: Bytes): string {
  let fs = from.toHexString();
  let ts = to.toHexString();

  return fs < ts ? fs + "-" + ts : ts + "-" + fs;
}

export function addOraclePair(oracleId: string, from: Bytes, to: Bytes): void {
  if (oracleId == "0x0000000000000000000000000000000000000000" || from == to) {
    return;
  }

  let oracle = getOracle(oracleId);
  let pairId = getPairId(from, to);

  if (oracle.pairList.indexOf(pairId) < 0) {
    oracle.pairList = addToList(oracle.pairList, pairId);

    oracle.save();
  }
}

export function updateOracleRates(oracleId: string, timestamp: BigInt): void {
  let oracle = getOracle(oracleId);
  let contract = RateOracleContract.bind(Address.fromString(oracleId));
  let pairs = oracle.pairList;

  let result = contract.try_avgGasPrice();

  if (!result.reverted) {
    oracle.avgGasPrice = result.value;
    oracle.save();
  }

  for (let i = 0; i < pairs.length; i++) {
    let pair = pairs[i];

    _updatePairRate(contract, pair, oracleId, timestamp);
  }
}

function _updatePairRate(contract: RateOracleContract, pair: string, oracleId: string, timestamp: BigInt): void {
  let fromTo = pair.split("-");
  let from = fromTo[0],
    to = fromTo[1];
  let fa = Address.fromString(from);
  let ta = Address.fromString(to);

  let r = contract.try_value(fa, ta);
  let rr = contract.try_value(ta, fa);

  if (!r.reverted && r.value.gt(BigInt.fromI32(0))) {
    updateRate(oracleId, from, to, r.value, timestamp);
  }

  if (!rr.reverted && rr.value.gt(BigInt.fromI32(0))) {
    updateRate(oracleId, to, from, rr.value, timestamp);
  }
}

export function updateRate(oracleId: string, from: string, to: string, value: BigInt, timestamp: BigInt): void {
  let id = oracleId + "-" + from + "-" + to;
  let r = new RateOraclePairRate(id);

  r.from = from;
  r.to = to;
  r.oracle = oracleId;
  r.value = value;
  r.updatedAt = timestamp;

  r.save();
}

export function handleBlock(block: ethereum.Block): void {
  if (block.number.mod(BigInt.fromI32(DELAY_BLOCK_COUNT)).equals(BigInt.fromI32(0))) {
    let context = dataSource.context();
    let oracleAddress = context.getString("oracleAddress");

    updateOracleRates(oracleAddress, block.timestamp);
  }
}
