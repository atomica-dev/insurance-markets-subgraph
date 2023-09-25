import { Bytes, BigInt } from "@graphprotocol/graph-ts";
import { LogMarketCharge } from "../generated/RiskPoolsController/RiskPoolsController";
import { getSystemConfig } from "./system";
import { UserFee, MarketUserFee, Market, Product } from "../generated/schema";

export enum FeeType {
  Governance,
  MarketManager,
  ProductManager,
}

function getFeeTypeString(feeType: FeeType): string {
  switch (feeType) {
    case FeeType.Governance:
      return "Governance";
    case FeeType.MarketManager:
      return "MarketManager";
    case FeeType.ProductManager:
      return "ProductManager";
  }

  return feeType.toString();
}

export function claimUserFee(token: Bytes, user: Bytes, type: string): void {
  const id = token.toHexString() + "-" + user.toHexString() + "-" + type;

  let userFee = UserFee.load(id);

  if (!userFee) {
    return;
  }

  userFee.claimedAmount = userFee.claimedAmount.plus(userFee.amount);
  userFee.amount = BigInt.fromI32(0);

  userFee.save();
}

export function updateUserFee(token: Bytes, user: Bytes, type: string, delta: BigInt): UserFee {
  const id = token.toHexString() + "-" + user.toHexString() + "-" + type;

  let userFee = UserFee.load(id);

  if (!userFee) {
    userFee = new UserFee(id);

    userFee.tokenId = token;
    userFee.userId = user;
    userFee.type = type;
    userFee.amount = BigInt.fromI32(0);
    userFee.claimedAmount = BigInt.fromI32(0);
  }

  userFee.amount = userFee.amount.plus(delta);

  userFee.save();

  return userFee;
}

export function updateMarketUserFee(userFee: UserFee, marketId: BigInt, delta: BigInt): MarketUserFee {
  const id = userFee.id + "-" + marketId.toString();

  let marketUserFee = MarketUserFee.load(id);

  if (!marketUserFee) {
    marketUserFee = new MarketUserFee(id);

    marketUserFee.tokenId = userFee.tokenId;
    marketUserFee.userId = userFee.userId;
    marketUserFee.type = userFee.type;
    marketUserFee.marketId = marketId;
    marketUserFee.amount = BigInt.fromI32(0);
    marketUserFee.claimedAmount = BigInt.fromI32(0);
    marketUserFee.claimedIndicator = userFee.claimedAmount;
  }

  if (marketUserFee.claimedIndicator != userFee.claimedAmount) {
    marketUserFee.claimedAmount = marketUserFee.claimedAmount.plus(marketUserFee.amount);
    marketUserFee.amount = delta;
    marketUserFee.claimedIndicator = userFee.claimedAmount;
  } else {
    marketUserFee.amount = marketUserFee.amount.plus(delta);
  }

  marketUserFee.save();

  return marketUserFee;
}

export function claimAllTypeFees(token: Bytes, user: Bytes): void {
  claimUserFee(token, user, getFeeTypeString(FeeType.Governance));
  claimUserFee(token, user, getFeeTypeString(FeeType.MarketManager));
  claimUserFee(token, user, getFeeTypeString(FeeType.ProductManager));
}

export function updateAllTypeFees(event: LogMarketCharge, token: Bytes, market: Market): void {
  const treasury = getSystemConfig(event.address.toHexString()).treasury;

  const governanceFee = updateUserFee(token, treasury, getFeeTypeString(FeeType.Governance), event.params.governanceFee);
  updateMarketUserFee(governanceFee, event.params.marketId, event.params.governanceFee);

  const marketManagerFee = updateUserFee(token, market.owner, getFeeTypeString(FeeType.MarketManager), event.params.marketOparatorFee);
  updateMarketUserFee(marketManagerFee, event.params.marketId, event.params.marketOparatorFee);

  const product = Product.load(market.product)!;
  const productManagerFee = updateUserFee(token, product.owner, getFeeTypeString(FeeType.ProductManager), event.params.productOperatorFee);
  updateMarketUserFee(productManagerFee, event.params.marketId, event.params.productOperatorFee);
}
