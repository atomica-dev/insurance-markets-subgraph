import { BigInt } from "@graphprotocol/graph-ts";

import { RiskPoolsController } from "../generated/RiskPoolsController/RiskPoolsController";
import { Market } from "../generated/schema";
import { getAggregatedPool } from "./contract-mapper";
import { WEI_BIGINT, min } from "./utils";

function getTailRate(
  premiumRatePerSec: BigInt,
  totalCapacity: BigInt,
  cover: BigInt,
  tailKink: BigInt,
  maxPremiumRatePerSec: BigInt,
  tailJumpPremiumRatePerSec: BigInt,
): BigInt {
  let rate = BigInt.fromI32(0);
  if (!tailKink.isZero()) {
    // dynamic
    const utilization = cover.isZero() ? BigInt.fromI32(0) : cover.times(WEI_BIGINT).div(totalCapacity);

    const baseRatePerSec = premiumRatePerSec;
    const multiplierPerSec = maxPremiumRatePerSec
      .minus(baseRatePerSec)
      .times(WEI_BIGINT)
      .div(tailKink);

    if (utilization.le(tailKink)) {
      rate = utilization
        .times(multiplierPerSec)
        .div(WEI_BIGINT)
        .plus(baseRatePerSec);
    } else {
      const jumpMultiplierPerSec = tailJumpPremiumRatePerSec
        .minus(maxPremiumRatePerSec)
        .times(WEI_BIGINT)
        .div(WEI_BIGINT.minus(tailKink));
      rate = min(utilization, WEI_BIGINT)
        .minus(tailKink)
        .times(jumpMultiplierPerSec)
        .div(WEI_BIGINT)
        .plus(tailKink.times(multiplierPerSec).div(WEI_BIGINT))
        .plus(baseRatePerSec);
    }
  } else {
    // lineal
    rate = cover.isZero()
      ? premiumRatePerSec
      : cover
          .times(maxPremiumRatePerSec.minus(premiumRatePerSec))
          .div(totalCapacity)
          .plus(premiumRatePerSec);
  }
  return rate;
}

class MarketRateAndActualCover {
  rate: BigInt;
  actualCover: BigInt;
}

export function getMarketRateAndActualCover(market: Market, rpcContract: RiskPoolsController): MarketRateAndActualCover {
  let remainder = market.desiredCover;
  if (remainder.isZero()) {
    return { rate: BigInt.fromI32(0), actualCover: BigInt.fromI32(0) };
  }

  let pureChargePerSecInCapitalToken = BigInt.fromI32(0);
  let actualCover = BigInt.fromI32(0);
  let cursor = market.headAggregatedPoolId;
  while (remainder.gt(BigInt.fromI32(0)) && cursor.gt(BigInt.fromI32(0))) {
    const aggPool = getAggregatedPool(rpcContract, cursor);
    if (!aggPool) {
      return { rate: BigInt.fromI32(0), actualCover: BigInt.fromI32(0) };
    }

    const cover = min(remainder, aggPool.totalCapacity);
    const isTail = aggPool.nextAggregatedPoolId.isZero();

    const rate = isTail
      ? getTailRate(
          aggPool.premiumRatePerSec,
          aggPool.totalCapacity,
          cover,
          market.tailKink,
          market.maxPremiumRatePerSec,
          market.tailJumpPremiumRatePerSec,
        )
      : aggPool.premiumRatePerSec;

    pureChargePerSecInCapitalToken = pureChargePerSecInCapitalToken.plus(rate.times(cover));
    remainder = remainder.minus(cover);
    actualCover = actualCover.plus(cover);
    cursor = aggPool.nextAggregatedPoolId;
  }

  if (actualCover.isZero()) {
    return { rate: BigInt.fromI32(0), actualCover };
  }

  const pureRatePerSec = pureChargePerSecInCapitalToken.div(actualCover);

  return { rate: pureRatePerSec, actualCover };
}
