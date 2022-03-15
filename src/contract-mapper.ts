import { RiskPoolsController as RiskPoolsControllerContract } from "../generated/templates/Product/RiskPoolsController";
import { Pool as RiskPoolContract } from "../generated/templates/Pool/Pool";
import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";

export class CPolicy {
  marketId: BigInt;
  validUntil: BigInt;
  coverChanged: BigInt;
  issuer: Address;
  waitingPeriod: BigInt;
  frontendOperator: Address;
  frontendOperatorFee: BigInt;
  referral: Address;
  referralFee: BigInt;
  desiredCover: BigInt;
  underlyingCover: BigInt;
}

export function getPolicy(
  contract: RiskPoolsControllerContract,
  id: BigInt
): CPolicy {
  let d = contract.policies(id);

  return {
    marketId: d.value0,
    validUntil: d.value1,
    coverChanged: d.value2,
    issuer: d.value3,
    waitingPeriod: d.value4,
    frontendOperator: d.value5,
    frontendOperatorFee: d.value6,
    referral: d.value7,
    referralFee: d.value8,
    desiredCover: d.value9,
    underlyingCover: d.value10,
  };
}

export class CPolicyDeposit {
  premiumFeeDeposit: BigInt;
  frontendOperatorFeeDeposit: BigInt;
  referralFeeDeposit: BigInt;
  premiumMulAccumulator: BigInt;
}

export function getPolicyDeposit(
  contract: RiskPoolsControllerContract,
  id: BigInt,
  token: Address
): CPolicyDeposit {
  let d = contract.policyDeposits(id, token);

  return {
    premiumFeeDeposit: d.value0,
    frontendOperatorFeeDeposit: d.value1,
    referralFeeDeposit: d.value2,
    premiumMulAccumulator: d.value3,
  };
}

export class CMarket {
  marketOperator: Address;
  product: Address;
  premiumToken: Address;
  capitalToken: Address;
  insuredToken: Address;
  coverAdjusterOracle: Address;
  ratesOracle: Address;
  payoutRequester: Address;
  payoutApprover: Address;
  title: string;
}

export function getMarket(
  contract: RiskPoolsControllerContract,
  id: BigInt
): CMarket {
  let d = contract.markets(id);
  return {
    marketOperator: d.value0,
    product: d.value1,
    premiumToken: d.value2,
    capitalToken: d.value3,
    insuredToken: d.value4,
    coverAdjusterOracle: d.value5,
    ratesOracle: d.value6,
    payoutRequester: d.value7,
    payoutApprover: d.value8,
    title: d.value9,
  };
}

export class CMarketMeta {
  desiredCover: BigInt;
  actualCover: BigInt;
  waitingPeriod: BigInt;
  marketOperatorIncentiveFee: BigInt;
  accrualBlockNumberPrior: BigInt;
  settlementDiscount: BigInt;
}

export function getMarketMeta(
  contract: RiskPoolsControllerContract,
  id: BigInt
): CMarketMeta {
  let d = contract.marketsMeta(id);

  return {
    desiredCover: d.value0,
    actualCover: d.value1,
    waitingPeriod: d.value2,
    marketOperatorIncentiveFee: d.value3,
    accrualBlockNumberPrior: d.value4,
    settlementDiscount: d.value5,
  };
}

export class CPayoutRequest {
  marketId: BigInt;
  policyId: BigInt;
  recipient: Address;
  distributor: boolean;
  baseAsset: Address;
  requestedAmount: BigInt;
  status: i32;
  rootHash: Bytes;
  data: string;
}

export function getPayoutRequest(
  contract: RiskPoolsControllerContract,
  id: BigInt
): CPayoutRequest {
  let d = contract.payoutRequests(id);

  return {
    marketId: d.value0,
    policyId: d.value1,
    recipient: d.value2,
    distributor: d.value3,
    baseAsset: d.value4,
    requestedAmount: d.value5,
    status: d.value6,
    rootHash: d.value7,
    data: d.value8,
  };
}

export class CForwardedPayoutRequest {
  sourceChainId: BigInt;
  sourcePayoutRequestId: BigInt;
  recipient: Address;
  riskPool: Address;
  amount: BigInt;
  rootHash: Bytes;
  data: string;
  status: i32;
}

export function getForwardedPayoutRequest(
  contract: RiskPoolsControllerContract,
  id: BigInt
): CForwardedPayoutRequest {
  let d = contract.forwardedPayoutRequests(id);

  return {
    sourceChainId: d.value0,
    sourcePayoutRequestId: d.value1,
    recipient: d.value2,
    riskPool: d.value3,
    amount: d.value4,
    rootHash: d.value5,
    data: d.value6,
    status: d.value7,
  };
}

export class CRiskPoolConnection {
  reserveWallet: Address;
  externalReserveWallet: Address;
  transferredToReserve: BigInt;
  active: boolean;
}

export function getRiskPoolConnection(
  contract: RiskPoolContract,
  chain: BigInt,
  id: Address
): CRiskPoolConnection {
  let d = contract.connectedRiskPools(chain, id);

  return {
    reserveWallet: d.value0,
    externalReserveWallet: d.value1,
    transferredToReserve: d.value2,
    active: d.value3,
  };
}
