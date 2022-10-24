import { BigInt, BigDecimal } from "@graphprotocol/graph-ts";
import { PremiumRateModel } from "../generated/schema";
import { WEI_BIGINT } from "./utils";
import { CPremiumRate } from "./contract-mapper";

enum PremiumRateType {
  Unknown = -1,
  Fixed = 0,
  Linear = 1,
  Dynamic = 2,
}

let SECONDS_IN_A_YEAR = BigInt.fromI32(60 * 60 * 24 * 365);
let WEI_DECIMALS = new BigDecimal(WEI_BIGINT);

export function createRateModel(id: string, cPremiumRate: CPremiumRate): void {
  let model = new PremiumRateModel(id);

  model.type = cPremiumRate.premiumRateType;
  let valueOf100 = BigInt.fromI32(100);

  model.rate0 = BigDecimal.fromString(
    cPremiumRate.baseRatePerSec
      .times(SECONDS_IN_A_YEAR)
      .times(valueOf100)
      .toString()
  ).div(WEI_DECIMALS);

  model.util1 = BigDecimal.fromString(
    cPremiumRate.kink.times(valueOf100).toString()
  ).div(WEI_DECIMALS);

  if (model.type === PremiumRateType.Linear) {
    model.rate1 = BigDecimal.fromString(
      cPremiumRate.multiplierPerSec
        .times(SECONDS_IN_A_YEAR)
        .toString()
    ).div(WEI_DECIMALS).plus(model.rate0!);
  }

  if (model.type === PremiumRateType.Dynamic) {
    model.rate1 = BigDecimal.fromString(
      cPremiumRate.multiplierPerSec
        .times(SECONDS_IN_A_YEAR)
        .toString()
    ).div(WEI_DECIMALS).times(model.util1!).plus(model.rate0!);
    model.rate1 = BigDecimal.fromString(
      cPremiumRate.multiplierPerSec
        .times(SECONDS_IN_A_YEAR)
        .toString()
    ).div(WEI_DECIMALS).times(BigDecimal.fromString("1").minus(model.util1!)).plus(model.rate1!);
  }

  model.save();
}
