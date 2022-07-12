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

export class PoolBucket {
  premiumAccumulator: BigInt;
  settlementAccumulator: BigInt;
  premiumTotalBalance: BigInt;
  settlementTotalBalance: BigInt;
}

export function getPoolBucket(
  contract: RiskPoolContract,
  token: Address,
): PoolBucket {
  let b = contract.buckets(token);

  return {
    premiumAccumulator: b.value0,
    settlementAccumulator: b.value1,
    premiumTotalBalance: b.value2,
    settlementTotalBalance: b.value3
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

export class CRiskTowerLevel {
  marketId: BigInt;
  nextRiskTowerLevelId: BigInt;
}

export function getRiskTowerLevel(
  contract: RiskPoolsControllerContract,
  marketId: BigInt
): CRiskTowerLevel {
  let d = contract.riskTowerLevels(marketId);

  return {
    marketId: d.value0,
    nextRiskTowerLevelId: d.value1,
  };
}

export class CAggregatedPool {
  marketId: BigInt;
  totalCapacity: BigInt;
  distributedCover: BigInt;
  premiumRateModel: Address;
}

export function getAggregatedPool(
  contract: RiskPoolsControllerContract,
  id: BigInt,
): CAggregatedPool {
  let d = contract.aggregatedPools(id);

  return {
    marketId: d.value0,
    totalCapacity: d.value1,
    distributedCover: d.value2,
    premiumRateModel: d.value3,
  };
}

export class CRiskPoolData {
  manager: Address;
  managerFeeRecipient: Address;
  nominatedToken: Address;
  managerFee: BigInt;
}

export function getRiskPoolData(
  contract: RiskPoolsControllerContract,
  id: Address
): CRiskPoolData {
  let d = contract.riskPools(id);

  return {
    manager: d.value0,
    managerFeeRecipient: d.value1,
    nominatedToken: d.value2,
    managerFee: d.value3
  };
}

export class CMarketMeta {
  riskTowerRootLevel: BigInt;
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
    riskTowerRootLevel: d.value0,
    desiredCover: d.value1,
    actualCover: d.value2,
    waitingPeriod: d.value3,
    marketOperatorIncentiveFee: d.value4,
    accrualBlockNumberPrior: d.value5,
    settlementDiscount: d.value6,
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
  refundWallet: Address;
  externalReserveWallet: Address;
  externalRefundWallet: Address;
  transferredToReserve: BigInt;
  active: boolean;
}

export function getRiskPoolConnection(
  contract: RiskPoolContract,
  chain: BigInt,
  id: Address
): CRiskPoolConnection {
  let d = contract.riskPoolsConnections(chain, id);

  return {
    reserveWallet: d.value0,
    refundWallet: d.value1,
    externalReserveWallet: d.value2,
    externalRefundWallet: d.value3,
    transferredToReserve: d.value4,
    active: d.value5,
  };
}

export class CCoverReward {
  distributor: Address;
  erc20: Address;
  amount: BigInt;
  marketId: BigInt;
  startTime: BigInt;
  endTime: BigInt;
  rate: BigInt;
  lastUpdateTime: BigInt;
  rewardPerShareStored: BigInt;
  archived: boolean;
  rootHash: Bytes;
  sid: string;
}

export function getCoverReward(
  contract: RiskPoolsControllerContract,
  id: BigInt,
): CCoverReward {
  let d = contract.rewards(id);

  return {
    distributor: d.value0,
    erc20: d.value1,
    amount: d.value2,
    marketId: d.value3,
    startTime: d.value4,
    endTime: d.value5,
    rate: d.value6,
    lastUpdateTime: d.value7,
    rewardPerShareStored: d.value8,
    archived: d.value9,
    rootHash: d.value10,
    sid: d.value11,
  };
}