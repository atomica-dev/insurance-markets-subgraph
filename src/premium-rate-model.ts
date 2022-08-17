import { Address, BigInt, BigDecimal } from "@graphprotocol/graph-ts";
import { PremiumRateModel } from "../generated/schema";
import { PremiumRateModelFixed } from "../generated/RiskPoolsController/PremiumRateModelFixed";
import { PremiumRateModelDynamic } from "../generated/RiskPoolsController/PremiumRateModelDynamic";
import { WEI_BIGINT } from "./utils";

enum PremiumModelType {
  Unknown = 0,
  Fixed = 1,
  Dynamic = 2,
}

let SECONDS_IN_A_YEAR = BigInt.fromI32(60 * 60 * 24 * 365);
let WEI_DECIMALS = new BigDecimal(WEI_BIGINT);

export function guessRateModelType(modelAddress: Address): void {
  let model = PremiumRateModel.load(modelAddress.toHexString());

  if (model /* && model.type != PremiumModelType.Unknown */) {
    return;
  }

  model = new PremiumRateModel(modelAddress.toHexString());

  model.type = PremiumModelType.Unknown;

  let fixedModelContract = PremiumRateModelFixed.bind(modelAddress);
  let rate0Result = fixedModelContract.try_ratePerSec();
  let hnd = BigInt.fromI32(100);

  if (!rate0Result.reverted) {
    model.rate0 = new BigDecimal(
      rate0Result.value.times(SECONDS_IN_A_YEAR).times(hnd)
    );
    model.type = PremiumModelType.Fixed;

    model.save();

    return;
  }

  let dynamicModelContract = PremiumRateModelDynamic.bind(modelAddress);
  let util1Result = dynamicModelContract.try_kink();

  rate0Result = dynamicModelContract.try_baseRatePerSec();

  if (rate0Result.reverted || util1Result.reverted) {
    model.save();

    return;
  }

  model.rate0 = BigDecimal.fromString(
    rate0Result.value
      .times(SECONDS_IN_A_YEAR)
      .times(hnd)
      .toString()
  ).div(WEI_DECIMALS);
  model.util1 = BigDecimal.fromString(
    util1Result.value.times(hnd).toString()
  ).div(WEI_DECIMALS);

  let rate1Result = dynamicModelContract.try_getPremiumRate(
    hnd,
    util1Result.value.times(hnd).div(WEI_BIGINT)
  );
  let rate2Result = dynamicModelContract.try_getPremiumRate(
    BigInt.fromI32(1),
    BigInt.fromI32(1)
  );

  if (rate1Result.reverted || rate2Result.reverted) {
    model.save();

    return;
  }

  model.rate1 = BigDecimal.fromString(
    rate1Result.value
      .times(SECONDS_IN_A_YEAR)
      .times(hnd)
      .toString()
  ).div(WEI_DECIMALS);
  model.rate2 = BigDecimal.fromString(
    rate2Result.value
      .times(SECONDS_IN_A_YEAR)
      .times(hnd)
      .toString()
  ).div(WEI_DECIMALS);
  model.type = PremiumModelType.Dynamic;

  model.save();
}
