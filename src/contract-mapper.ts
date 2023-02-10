import { RiskPoolsController as RiskPoolsControllerContract } from "../generated/RiskPoolsController/RiskPoolsController";
import { Pool as RiskPoolContract } from "../generated/templates/Pool/Pool";
import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";

export class CPolicy {
  marketId: BigInt;
  validUntil: BigInt;
  coverChanged: BigInt;
  waitingPeriod: BigInt;
  frontendOperator: Address;
  frontendOperatorFee: BigInt;
  referralBonus: BigInt;
  referral: Address;
  referralFee: BigInt;
  desiredCover: BigInt;
  underlyingCover: BigInt;
}

export function getPolicy(contract: RiskPoolsControllerContract, id: BigInt): CPolicy {
  let d = contract.policies(id);

  return {
    marketId: d.value0,
    validUntil: d.value1,
    coverChanged: d.value2,
    waitingPeriod: d.value3,
    frontendOperator: d.value4,
    frontendOperatorFee: d.value5,
    referralBonus: d.value6,
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

export function getPolicyDeposit(contract: RiskPoolsControllerContract, id: BigInt, token: Address): CPolicyDeposit {
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

export function getPoolBucket(contract: RiskPoolContract, token: Address): PoolBucket {
  let b = contract.buckets(token);

  return {
    premiumAccumulator: b.value0,
    settlementAccumulator: b.value1,
    premiumTotalBalance: b.value2,
    settlementTotalBalance: b.value3,
  };
}

export class CProduct {
  productOperator: Address;
  claimProcessor: Address;
  payoutRequester: Address;
  payoutApprover: Address;
  defaultPremiumToken: Address;
  defaultCapitalToken: Address;
  defaultCoverAdjusterOracle: Address;
  defaultRatesOracle: Address;
  marketCreationFeeToken: Address;
}

export function getProduct(contract: RiskPoolsControllerContract, id: BigInt): CProduct {
  let d = contract.products(id);

  return {
    productOperator: d.value0,
    claimProcessor: d.value1,
    payoutRequester: d.value2,
    payoutApprover: d.value3,
    defaultPremiumToken: d.value4,
    defaultCapitalToken: d.value5,
    defaultCoverAdjusterOracle: d.value6,
    defaultRatesOracle: d.value7,
    marketCreationFeeToken: d.value8,
  };
}

export class CProductMeta {
  marketCreationFee: BigInt;
  productOperatorIncentiveFee: BigInt;
  maxMarketOperatorIncentiveFee: BigInt;
  withdrawDelay: BigInt;
  withdrawRequestExpiration: BigInt;
  waitingPeriod: BigInt;
  marketCreatorsListId: BigInt;
  settlement: number;
  status: i32;
  title: string;
  wording: string;
}

export function getProductMeta(contract: RiskPoolsControllerContract, id: BigInt): CProductMeta {
  let d = contract.productsMeta(id);

  return {
    marketCreationFee: d.value0,
    productOperatorIncentiveFee: d.value1,
    maxMarketOperatorIncentiveFee: d.value2,
    withdrawDelay: d.value3,
    withdrawRequestExpiration: d.value4,
    waitingPeriod: d.value5,
    marketCreatorsListId: d.value6,
    settlement: d.value7,
    status: d.value8,
    title: d.value9,
    wording: d.value10,
  };
}

export class CMarket {
  marketOperator: Address;
  marketFeeRecipient: Address;
  premiumToken: Address;
  capitalToken: Address;
  insuredToken: Address;
  coverAdjusterOracle: Address;
  ratesOracle: Address;
  productId: BigInt;
  title: string;
}

export function getMarket(contract: RiskPoolsControllerContract, id: BigInt): CMarket {
  let d = contract.markets(id);

  return {
    marketOperator: d.value0,
    marketFeeRecipient: d.value1,
    premiumToken: d.value2,
    capitalToken: d.value3,
    insuredToken: d.value4,
    coverAdjusterOracle: d.value5,
    ratesOracle: d.value6,
    productId: d.value7,
    title: d.value8,
  };
}

export class CAggregatedPool {
  marketId: BigInt;
  totalCapacity: BigInt;
  premiumAccumulator: BigInt;
  premiumBalance: BigInt;
  nextAggregatedPoolId: BigInt;
  prevAggregatedPoolId: BigInt;
  premiumRatePerSec: BigInt;
}

export function getAggregatedPool(contract: RiskPoolsControllerContract, id: BigInt): CAggregatedPool {
  let d = contract.aggregatedPools(id);

  return {
    marketId: d.value0,
    totalCapacity: d.value1,
    premiumAccumulator: d.value2,
    premiumBalance: d.value3,
    nextAggregatedPoolId: d.value4,
    prevAggregatedPoolId: d.value5,
    premiumRatePerSec: d.value6,
  };
}

export class CRiskPoolData {
  manager: Address;
  managerFeeRecipient: Address;
  nominatedToken: Address;
  managerFee: BigInt;
  agreement: string;
}

export function getRiskPoolData(contract: RiskPoolsControllerContract, id: Address): CRiskPoolData {
  let d = contract.riskPools(id);

  return {
    manager: d.value0,
    managerFeeRecipient: d.value1,
    nominatedToken: d.value2,
    managerFee: d.value3,
    agreement: d.value4,
  };
}

export class CMarketMeta {
  totalCapacity: BigInt;
  desiredCover: BigInt;
  waitingPeriod: BigInt;
  marketOperatorIncentiveFee: BigInt;
  lastChargeTimestamp: BigInt;
  settlementDiscount: BigInt;
  withdrawDelay: BigInt;
  headAggregatedPoolId: BigInt;
  tailCover: BigInt;
  maxPremiumRatePerSec: BigInt;
  bidStepPremiumRatePerSec: BigInt;
  maxAggregatedPoolSlots: BigInt;
  tailKink: BigInt;
  tailJumpPremiumRatePerSec: BigInt;
}

export function getMarketMeta(contract: RiskPoolsControllerContract, id: BigInt): CMarketMeta {
  let d = contract.marketsMeta(id);

  return {
    totalCapacity: d.value0,
    desiredCover: d.value1,
    waitingPeriod: d.value2,
    marketOperatorIncentiveFee: d.value3,
    lastChargeTimestamp: d.value4,
    settlementDiscount: d.value5,
    withdrawDelay: d.value6,
    headAggregatedPoolId: d.value7,
    tailCover: d.value8,
    maxPremiumRatePerSec: d.value9,
    bidStepPremiumRatePerSec: d.value10,
    maxAggregatedPoolSlots: d.value11,
    tailKink: d.value12,
    tailJumpPremiumRatePerSec: d.value13,
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

export function getPayoutRequest(contract: RiskPoolsControllerContract, id: BigInt): CPayoutRequest {
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

export function getForwardedPayoutRequest(contract: RiskPoolsControllerContract, id: BigInt): CForwardedPayoutRequest {
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

export function getRiskPoolConnection(contract: RiskPoolContract, chain: BigInt, id: Address): CRiskPoolConnection {
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
  deactivated: boolean;
  rootHash: Bytes;
  cid: string;
  proofsCid: string;
}

export function getCoverReward(contract: RiskPoolsControllerContract, id: BigInt): CCoverReward {
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
    deactivated: d.value9,
    rootHash: d.value10,
    cid: d.value11,
    proofsCid: d.value12,
  };
}

export class CList {
  type: i32;
  editor: Address;
  descriptionCid: string;
}

export function getList(contract: RiskPoolsControllerContract, id: BigInt): CList {
  let d = contract.lists(id);

  return {
    type: d.value0,
    editor: d.value1,
    descriptionCid: d.value2,
  };
}
