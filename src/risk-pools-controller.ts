import {
  LogGovernance,
  LogLiquidation,
  LogMarketStatusChanged,
  LogNewMarketStatus,
  LogNewPool,
  LogNewProduct,
  LogNewProductStatus,
  LogNewSystemStatus,
  LogPolicyCoverChanged,
  LogPermissionTokenIssued,
  LogPolicyDeposit,
  LogPolicyWithdraw,
  LogWithdrawFee,
  LogFeeAccrued,
  RiskPoolsController,
  LogSwap,
  LogPayout,
  LogNewPayoutRequest,
  LogNewForwardedPayoutRequest,
  LogForwardedPayoutRequestProcessed,
  LogForwardedPayoutRequestDeclined,
  LogRewardClaimed,
  LogIncreaseRewardAmount,
  LogNewReward,
  LogMarketCharge,
  LogAggregatedPoolCreated,
  LogAggregatedPoolRemoved,
  LogRiskTowerLevelCreated1,
  LogRiskTowerLevelRemoved,
  LogRiskPoolAddedToAggregatedPool,
  LogRiskPoolRemovedFromAggregatedPool,
  LogRebalance,
  LogAggregatedPoolMarketCapacityLimitUpdated,
  LogAggregatedPoolRiskPoolCapacityLimitUpdated,
  LogAggregatedPoolCapacityAllowanceUpdated,
  LogRiskPoolManagerChanged,
  LogRiskPoolManagerFeeChanged,
  LogRiskPoolManagerFeeRecipientChanged,
  LogCoverMiningRewardArchived,
  LogArchivedRewardClaimed,
  LogWithdrawAccruedMarketFee,
  LogPremiumEarned,
} from "../generated/RiskPoolsController/RiskPoolsController";
import { RiskPoolsController as RiskPoolsControllerContract } from "../generated/templates/Product/RiskPoolsController";
import {
  PolicyPermissionTokenIssuer,
  PolicyTokenIssuer,
  Product as ProductTemplate,
  PayoutRequester as PayoutRequesterTemplate,
} from "../generated/templates";
import {
  Market,
  Policy,
  PolicyPermissionToken,
  Pool,
  PoolMarketRelation,
  Product,
  AccruedFee,
  MarketAccruedFee,
  Swap,
  Payout,
  PayoutRequest,
  IncomingPayoutRequest,
  CoverMiningReward,
  CoverMiningRewardClaim,
  RiskTowerLevel,
  AggregatedPool,
  PoolFee,
  MarketPoolFee,
  FeeRecipientPool,
  MarketAggregatedPool,
} from "../generated/schema";
import {
  addEvent,
  EventType,
  getState,
  updateAndLogState,
  updateState,
  updateSystemStatus,
} from "./event";
import {
  Address,
  BigInt,
  Bytes,
  ethereum,
  log,
  store,
} from "@graphprotocol/graph-ts";
import { createPool, updateFeeRecipientRelation } from "./product";
import { Product as ProductContract } from "../generated/RiskPoolsController/Product";
import { PolicyTokenIssuer as PolicyTokenIssuerContract } from "../generated/RiskPoolsController/PolicyTokenIssuer";
import { getSystemConfig } from "./system";
import {
  CPolicy,
  getAggregatedPool,
  getCoverReward,
  getForwardedPayoutRequest,
  getMarketCoverDetails,
  getMarketMeta,
  getPayoutRequest,
  getPolicy,
  getPolicyDeposit,
} from "./contract-mapper";
import { PremiumRateModelDynamic as PremiumRateModelContract } from "../generated/templates/Pool/PremiumRateModelDynamic";
import { claimAllTypeFees, updateAllTypeFees } from "./fee";
import { GovernanceOperationMap } from "./governance-operations";
import { addToList, filterNotEqual, WEI_BIGINT } from "./utils";

export function handleLogNewProduct(event: LogNewProduct): void {
  getState(EventType.SystemStatus).save();
  getSystemConfig(event.address.toHexString());

  let productAddress = event.params.product;
  let productContract = ProductContract.bind(productAddress);
  let riskPoolsControllerAddress = event.address;
  let riskPoolsControllerContract = RiskPoolsControllerContract.bind(
    riskPoolsControllerAddress
  );

  let productInfo = riskPoolsControllerContract.products(productAddress);
  let product = new Product(productAddress.toHexString());

  product.riskPoolsControllerAddress = riskPoolsControllerAddress;
  product.policyTokenIssuerAddress = riskPoolsControllerContract.policyTokenIssuer();
  product.title = productContract.title();
  product.claimProcessor = productContract.claimProcessor();
  product.treasuryAddress = productContract.treasury();
  product.allowListAddress = productContract.allowlist();
  product.wording = productInfo.value0;
  product.cashSettlementIsEnabled = productContract.cashSettlement();
  product.physicalSettlementIsEnabled = productContract.physicalSettlement();
  product.feeToken = productContract.feeToken();
  product.marketCreationFeeAmount = productContract.marketCreationFeeAmount();
  product.defaultPremiumToken = productContract.defaultPremiumToken();
  product.defaultCapitalToken = productContract.defaultCapitalToken();
  product.defaultCoverAdjusterOracle = productContract.defaultCoverAdjusterOracle();
  product.payoutApprover = productContract.payoutApprover();
  product.payoutRequester = productContract.payoutRequester();
  product.productIncentiveFee = productInfo.value2;
  product.maxMarketIncentiveFee = productInfo.value3;

  product.defaultPremiumRateModels = changetype<Bytes[]>(
    productContract.getDefaultPremiumRateModels()
  );
  product.defaultRatesOracle = productContract.defaultRatesOracle();
  product.withdrawalDelay = productContract.withdrawalDelay();
  product.withdrawRequestExpiration = productContract.withdrawRequestExpiration();
  product.waitingPeriod = productContract.waitingPeriod();
  product.marketCreatorsAllowlistId = productContract.marketCreatorsAllowlistId();
  product.operator = productInfo.value1;

  product.createdAt = event.block.timestamp;
  product.createdBy = event.transaction.from;
  product.updatedAt = event.block.timestamp;
  product.status = productInfo.value5;

  product.save();

  ProductTemplate.create(productAddress);
  let rpcContract = RiskPoolsControllerContract.bind(
    riskPoolsControllerAddress
  );
  PolicyTokenIssuer.create(rpcContract.policyTokenIssuer());
  PolicyPermissionTokenIssuer.create(rpcContract.policyTokenPermissionIssuer());
  PayoutRequesterTemplate.create(changetype<Address>(product.claimProcessor));

  updateState(EventType.SystemProductCount, BigInt.fromI32(1), null);
}

export function handleLogLiquidation(event: LogLiquidation): void {
  let rpcContract = RiskPoolsController.bind(event.address);
  let id =
    rpcContract.policyTokenIssuer().toHexString() +
    "-" +
    event.params.policyId.toString();

  updatePolicy(id, event.address, event);
}

function updatePolicyCoverage(
  policy: Policy,
  cPolicy: CPolicy,
  event: ethereum.Event
): void {
  let newCoverage = cPolicy.desiredCover;

  if (policy.coverage.equals(newCoverage)) {
    return;
  }

  let oldCoverage = policy.coverage;

  policy.coverage = newCoverage;
  policy.underlyingCover = cPolicy.underlyingCover;
  policy.expired = newCoverage.equals(BigInt.fromI32(0));

  if (newCoverage.equals(BigInt.fromI32(0))) {
    policy.liquidatedAt = event.block.timestamp;
    policy.liquidatedBy = event.transaction.from.toHexString();

    updateAndLogState(
      EventType.TotalPolicies,
      event,
      BigInt.fromI32(-1),
      policy.market
    );
  }

  let market = Market.load(policy.market.toString())!;

  updateAndLogState(
    EventType.MarketExposure,
    event,
    policy.coverage.minus(oldCoverage),
    policy.market
  );

  updateState(
    EventType.SystemDesiredCoverage,
    policy.coverage.minus(oldCoverage),
    null,
    market.capitalToken.toHexString()
  );
}

export function handleLogPolicyCoverChanged(
  event: LogPolicyCoverChanged
): void {
  let rpcContract = RiskPoolsController.bind(event.address);
  let id =
    rpcContract.policyTokenIssuer().toHexString() +
    "-" +
    event.params.policyId.toString();

  updatePolicy(id, event.address, event);
}

export function handleLogNewPool(event: LogNewPool): void {
  let poolId = event.params.newPool;

  createPool(poolId, event);
}

export function marketPremiumEarned(
  marketId: string,
  premium: BigInt,
  token: Address,
  event: ethereum.Event
): void {
  updatePolicyBalances(marketId, token);
  updateAndLogState(EventType.MarketEarnedPremium, event, premium, marketId);
}

export function handleLogMarketStatusChanged(
  event: LogMarketStatusChanged
): void {
  let id = event.address.toHexString() + "-" + event.params.marketId.toString();

  let market = Market.load(id)!;

  market.isEnabled = event.params.enabled;

  market.save();
}

function updatePolicyBalances(
  marketId: string,
  backTokenAddress: Address
): void {
  let market = Market.load(marketId)!;

  let productContract = ProductContract.bind(
    Address.fromString(market.product)
  );
  let rpcContract = RiskPoolsControllerContract.bind(
    productContract.riskPoolsController()
  );
  let ptiAddress = rpcContract.policyTokenIssuer();
  let ptiContract = PolicyTokenIssuerContract.bind(ptiAddress);

  let policyCount = ptiContract.lastPolicyId().toI32();

  let totalCharged = BigInt.fromI32(0);

  for (let i = 1; i <= policyCount; i++) {
    let policy = Policy.load(ptiAddress.toHexString() + "-" + i.toString());

    if (!policy || !policy.market || policy.market != marketId) {
      continue;
    }

    let oldBalance = policy.balance;
    let result = rpcContract.try_policyBalance(
      policy.policyId,
      backTokenAddress
    );
    let balance = !result.reverted ? result.value : BigInt.fromI32(0);

    policy.balance = balance;
    policy.totalCharged = policy.originalBalance.minus(balance);

    policy.save();

    totalCharged = totalCharged.plus(oldBalance).minus(policy.balance);
  }

  updateState(
    EventType.SystemPremiumEarned,
    totalCharged,
    null,
    backTokenAddress.toHexString()
  );
}

export function handleLogGovernance(event: LogGovernance): void {
  if (GovernanceOperationMap.has(event.params.logType)) {
    GovernanceOperationMap.get(event.params.logType)(event);

    return;
  }

  log.warning("Unknown governance update {}", [
    event.params.logType.toString(),
  ]);
}

export function handleLogNewSystemStatus(event: LogNewSystemStatus): void {
  updateSystemStatus(event.params.status);

  let config = getSystemConfig(event.address.toHexString());

  config.status = event.params.status;

  config.save();
}

export function handleLogNewProductStatus(event: LogNewProductStatus): void {
  let product = Product.load(event.params.product.toHexString());

  if (!product) {
    return;
  }

  product.status = event.params.status;

  product.save();
}

export function handleLogNewMarketStatus(event: LogNewMarketStatus): void {
  let id = event.address.toHexString() + "-" + event.params.marketId.toString();
  let market = Market.load(id);

  if (!market) {
    return;
  }

  market.status = event.params.status;

  market.save();
}

export function handleLogPermissionTokenIssued(
  event: LogPermissionTokenIssued
): void {
  let pToken = new PolicyPermissionToken(event.params.permissionId.toString());
  let rpcContract = RiskPoolsControllerContract.bind(event.address);

  pToken.policyId = event.params.policyId;
  pToken.policy =
    rpcContract.policyTokenIssuer().toHexString() +
    "-" +
    event.params.policyId.toString();
  pToken.owner = event.params.receiver;

  pToken.save();
}

export function handleLogPolicyDeposit(event: LogPolicyDeposit): void {
  let rpcContract = RiskPoolsControllerContract.bind(event.address);
  let id =
    rpcContract.policyTokenIssuer().toHexString() +
    "-" +
    event.params.policyId.toString();
  let policy = Policy.load(id);

  if (!policy) {
    return;
  }

  policy.originalBalance = policy.originalBalance
    .plus(event.params.premiumFeeDeposit)
    .plus(event.params.frontendOperatorFeeDeposit)
    .plus(event.params.referralFeeDeposit);

  policy.save();

  updatePolicy(id, event.address, event);
}

function loadPolicyByRpc(rpcAddress: Address, policyId: BigInt): Policy | null {
  let rpcContract = RiskPoolsControllerContract.bind(rpcAddress);
  let id =
    rpcContract.policyTokenIssuer().toHexString() + "-" + policyId.toString();

  return Policy.load(id);
}

export function handleLogPolicyWithdraw(event: LogPolicyWithdraw): void {
  let policy = loadPolicyByRpc(event.address, event.params.policyId);

  if (!policy) {
    return;
  }

  policy.originalBalance = policy.originalBalance
    .minus(event.params.withdrawnPremiumFeeDeposit)
    .minus(event.params.withdrawnFrontendOperatorFeeDeposit)
    .minus(event.params.withdrawnReferralFeeDeposit);

  policy.save();

  updatePolicy(policy.id, event.address, event);
}

function updatePolicy(
  id: string,
  rpcAddress: Address,
  event: ethereum.Event
): void {
  let policy = Policy.load(id)!;

  let rpcContract = RiskPoolsControllerContract.bind(rpcAddress);
  let market = Market.load(policy.market)!;
  let result = rpcContract.try_policyBalance(
    policy.policyId,
    changetype<Address>(market.premiumToken)
  );
  let pInfo = getPolicyDeposit(
    rpcContract,
    policy.policyId,
    changetype<Address>(market.premiumToken)
  );
  let balance = !result.reverted ? result.value : BigInt.fromI32(0);

  policy.totalCharged = policy.originalBalance.minus(balance);
  policy.balance = balance;

  policy.premiumDeposit = pInfo.premiumFeeDeposit;
  policy.foFeeDeposit = pInfo.frontendOperatorFeeDeposit;
  policy.referralFeeDeposit = pInfo.referralFeeDeposit;
  policy.initialMarketPremiumMulAccumulator = pInfo.premiumMulAccumulator;

  policy.updatedAt = event.block.timestamp;

  updatePolicyCoverage(policy, getPolicy(rpcContract, policy.policyId), event);

  policy.save();
}

export function handleLogFeeAccrued(event: LogFeeAccrued): void {
  let policy = loadPolicyByRpc(event.address, event.params.policyId);

  if (!policy) {
    return;
  }

  increaseFeeRecipientBalance(
    event.params.frontendOperatorFeeRecipient,
    event.params.premiumToken,
    event.params.frontendOperatorFee,
    policy.market
  );
  increaseFeeRecipientBalance(
    event.params.referralFeeRecipient,
    event.params.premiumToken,
    event.params.referralFee,
    policy.market
  );

  updatePolicy(policy.id, event.address, event);
}

function increaseFeeRecipientBalance(
  recipient: Address,
  token: Address,
  amount: BigInt,
  marketId: string
): void {
  let id = recipient.toHexString() + "-" + token.toHexString();
  let af = AccruedFee.load(id);

  if (!af) {
    af = new AccruedFee(id);

    af.recipientAddress = recipient;
    af.tokenAddress = token;
    af.balance = BigInt.fromI32(0);
    af.claimedBalance = BigInt.fromI32(0);
  }

  af.balance = af.balance.plus(amount);

  af.save();

  let mid = id + "-" + marketId;

  let maf = MarketAccruedFee.load(mid);

  if (!maf) {
    maf = new MarketAccruedFee(mid);

    maf.marketId = marketId;
    maf.recipientAddress = recipient;
    maf.tokenAddress = token;
    maf.balance = BigInt.fromI32(0);
    maf.claimedBalance = af.claimedBalance;
    maf.claimedIndicator = BigInt.fromI32(0);
  }

  if (maf.claimedIndicator != af.claimedBalance) {
    maf.claimedBalance = maf.claimedBalance.plus(maf.balance);
    maf.balance = amount;
    maf.claimedIndicator = af.claimedBalance;
  } else {
    maf.balance = maf.balance.plus(amount);
  }

  maf.save();
}

export function handleLogWithdrawFee(event: LogWithdrawFee): void {
  let id =
    event.params.requester.toHexString() +
    "-" +
    event.params.erc20.toHexString();
  let af = AccruedFee.load(id);

  if (!af) {
    return;
  }

  af.balance = af.balance.minus(event.params.amount);
  af.claimedBalance = af.claimedBalance.plus(event.params.amount);

  af.save();
}



export function handleLogSwap(event: LogSwap): void {
  let id = updateState(EventType.SwapCount, BigInt.fromI32(1), "");

  let s = new Swap(id.toString());

  s.policyId = event.params.policyId;
  s.insuredToken = event.params.insuredToken;
  s.capitalToken = event.params.capitalToken;
  s.swapAmount = event.params.insuredTokenSwapped;
  s.swapCover = event.params.marketCapitalTokenCoverSwapped;
  s.recipient = event.params.recipient;
  s.createdAt = event.block.timestamp;

  s.save();

  let rpcContract = RiskPoolsController.bind(event.address);
  let policyId =
    rpcContract.policyTokenIssuer().toHexString() +
    "-" +
    event.params.policyId.toString();
  updatePolicy(policyId, event.address, event);
}

export function handleLogPayout(event: LogPayout): void {
  let id = updateState(EventType.PayoutCount, BigInt.fromI32(1), "");

  let p = new Payout(id.toString());

  p.marketId = event.params.marketId;
  p.capitalToken = event.params.capitalToken;
  p.amount = event.params.paidoutAmount;
  p.recipient = event.params.recipient;

  p.save();
}

export function handleLogNewPayoutRequest(event: LogNewPayoutRequest): void {
  let rpcContract = RiskPoolsControllerContract.bind(event.address);

  let r = getPayoutRequest(rpcContract, event.params.payoutRequestId);

  let request = new PayoutRequest(event.params.payoutRequestId.toString());

  request.marketId = r.marketId;
  request.policyId = r.policyId;
  request.recipient = r.recipient;
  request.distributor = r.distributor;
  request.baseAsset = r.baseAsset;
  request.requestedAmount = r.requestedAmount;
  request.status = r.status;
  request.rootHash = r.rootHash.toHexString();
  request.data = r.data;
  request.externalRecipientList = [];

  request.save();
}

export function handleLogNewForwardedPayoutRequest(
  event: LogNewForwardedPayoutRequest
): void {
  let rpcContract = RiskPoolsControllerContract.bind(event.address);

  let r = getForwardedPayoutRequest(rpcContract, event.params.payoutRequestId);

  let request = new IncomingPayoutRequest(
    event.params.payoutRequestId.toString()
  );

  request.sourceChainId = r.sourceChainId;
  request.sourcePayoutRequestId = r.sourcePayoutRequestId;
  request.recipient = r.recipient;
  request.poolId = r.riskPool;
  request.amount = r.amount;
  request.rootHash = r.rootHash.toHexString();
  request.data = r.data;
  request.status = r.status;
  request.createdAt = event.block.timestamp;

  request.save();
}

export function handleLogForwardedPayoutRequestProcessed(
  event: LogForwardedPayoutRequestProcessed
): void {
  let request = IncomingPayoutRequest.load(
    event.params.forwardedPayoutRequestId.toString()
  )!;

  request.status = 2; // Processed

  request.save();
}

export function handleLogForwardedPayoutRequestDeclined(
  event: LogForwardedPayoutRequestDeclined
): void {
  let request = IncomingPayoutRequest.load(
    event.params.forwardedPayoutRequestId.toString()
  )!;

  request.status = 1; // Declined

  request.save();
}

export function handleLogNewReward(event: LogNewReward): void {
  let rpcContract = RiskPoolsControllerContract.bind(event.address);
  let reward = getCoverReward(rpcContract, event.params.rewardId);
  let cmReward = new CoverMiningReward(event.params.rewardId.toString());

  cmReward.market =
    event.address.toHexString() + "-" + reward.marketId.toString();
  cmReward.amount = reward.amount;
  cmReward.creator = event.transaction.from;
  cmReward.rewardToken = reward.erc20;
  cmReward.startedAt = reward.startTime;
  cmReward.endedAt = reward.endTime;
  cmReward.ratePerSecond = reward.rate;
  cmReward.updatedAt = event.block.timestamp;
  cmReward.rewardPerToken = reward.rewardPerShareStored;
  cmReward.cid = reward.sid;
  cmReward.rootHash = reward.rootHash;

  cmReward.save();
}

export function handleLogIncreaseRewardAmount(
  event: LogIncreaseRewardAmount
): void {
  let cmReward = CoverMiningReward.load(event.params.rewardId.toString());

  if (!cmReward) {
    return;
  }

  cmReward.amount = cmReward.amount.plus(event.params.amount);

  cmReward.save();
}

function _claimReward(
  rewardId: BigInt,
  amount: BigInt,
  policyId: BigInt,
  from: Address,
  timestamp: BigInt
): void {
  let cmReward = CoverMiningReward.load(rewardId.toString());

  if (!cmReward) {
    return;
  }

  cmReward.amount = cmReward.amount.minus(amount);

  cmReward.save();

  let id =
    from.toHexString() + "-" + rewardId.toString() + "-" + policyId.toString();
  let cmRewardClaim = CoverMiningRewardClaim.load(id);

  if (!cmRewardClaim) {
    cmRewardClaim = new CoverMiningRewardClaim(id);

    cmRewardClaim.rewardId = rewardId;
    cmRewardClaim.policyId = policyId;
    cmRewardClaim.account = from;
    cmRewardClaim.amount = BigInt.fromI32(0);
  }

  cmRewardClaim.amount = cmRewardClaim.amount.plus(amount);
  cmRewardClaim.updatedAt = timestamp;

  cmRewardClaim.save();
}

export function handleLogRewardClaimed(event: LogRewardClaimed): void {
  _claimReward(
    event.params.rewardId,
    event.params.rewardAmount,
    event.params.policyId,
    event.transaction.from,
    event.block.timestamp
  );
}

export function handleLogArchivedRewardClaimed(
  event: LogArchivedRewardClaimed
): void {
  _claimReward(
    event.params.rewardId,
    event.params.amount,
    event.params.policyId,
    event.transaction.from,
    event.block.timestamp
  );
}

export function handleLogCoverMiningRewardArchived(
  event: LogCoverMiningRewardArchived
): void {
  let cmReward = CoverMiningReward.load(event.params.rewardId.toString());

  if (!cmReward) {
    return;
  }

  cmReward.isArchived = true;
  cmReward.rootHash = event.params.rootHash;

  cmReward.save();
}

function updateAggPoolCover(event: ethereum.Event, aggPool: AggregatedPool, newCover: BigInt): void {
  aggPool.coverage = newCover;
  aggPool.rate = getAggPoolCurrentRate(aggPool);

  aggPool.save();

  addEvent(
    EventType.PoolExposure,
    event,
    aggPool.market,
    aggPool.id,
    aggPool.coverage.toString()
  );
}

export function handleLogPremiumEarned(event: LogPremiumEarned): void {
  const marketId = event.address.toHexString() + "-" + event.params.marketId.toString();

  updateMarketChargeState(event.address, marketId, event);
}

export function handleLogMarketCharge(event: LogMarketCharge): void {
  let aggPool = AggregatedPool.load(event.params.addregatedPoolId.toString());

  if (!aggPool) {
    return;
  }

  let market = Market.load(aggPool.market)!;
  let token = market.premiumToken;

  for (let i = 0; i < aggPool.poolList.length; i++) {
    let poolId = aggPool.poolList[i];
    let pool = Pool.load(poolId)!;
    let pmrId = poolId + "-" + aggPool.id;
    let pmRelation = PoolMarketRelation.load(pmrId);
    let id = poolId + "-" + token.toHexString();

    if (!pmRelation || pmRelation.balance.isZero()) {
      continue;
    }

    let poolPremium = pmRelation.balance
      .times(event.params.premium)
      .div(aggPool.totalCapacity);

    let pf = PoolFee.load(id);

    if (!pf) {
      pf = new PoolFee(id);

      pf.poolId = Address.fromHexString(poolId);
      pf.tokenId = token;
      pf.pool = poolId;
      pf.amount = BigInt.fromI32(0);
      pf.claimedAmount = BigInt.fromI32(0);
    }

    let amount = poolPremium.times(pool.managerFee).div(WEI_BIGINT);

    pf.amount = pf.amount.plus(amount);

    pf.save();

    let mid = id + "-" + market.marketId.toString();
    let mpf = MarketPoolFee.load(mid);

    if (!mpf) {
      mpf = new MarketPoolFee(mid);

      mpf.poolId = Address.fromHexString(poolId);
      mpf.marketId = event.params.marketId;
      mpf.tokenId = token;
      mpf.pool = poolId;
      mpf.amount = BigInt.fromI32(0);
      mpf.claimedAmount = BigInt.fromI32(0);
      mpf.claimedIndicator = BigInt.fromI32(0);
    }

    if (mpf.claimedIndicator != pf.claimedAmount) {
      mpf.claimedAmount = mpf.claimedAmount.plus(mpf.amount);
      mpf.amount = amount;
      mpf.claimedIndicator = pf.claimedAmount;
    } else {
      mpf.amount = mpf.amount.plus(amount);
    }

    mpf.save();
  }

  updateAllTypeFees(event, token, market);
}

export function handleLogWithdrawAccruedMarketFee(
  event: LogWithdrawAccruedMarketFee
): void {
  let feeRecipient = event.params.delegate;
  let feeRecipientPool = FeeRecipientPool.load(feeRecipient.toHexString());

  if (!feeRecipientPool) {
    return;
  }

  for (let i = 0; i < feeRecipientPool.poolList.length; i++) {
    let poolId = feeRecipientPool.poolList[i];

    let id = poolId + "-" + event.params.erc20.toHexString();

    let pf = PoolFee.load(id);

    if (!pf) {
      continue;
    }

    pf.claimedAmount = pf.claimedAmount.plus(pf.amount);
    pf.amount = BigInt.fromI32(0);

    pf.save();
  }

  claimAllTypeFees(event.params.erc20, event.params.delegate);
}

export function handleLogAggregatedPoolCapacityAllowanceUpdated(
  event: LogAggregatedPoolCapacityAllowanceUpdated
): void {
  let aggPool = AggregatedPool.load(event.params.aggregatedPoolId.toString());

  if (!aggPool) {
    return;
  }

  let id = event.params.riskPool.toHexString() + "-" + aggPool.id;
  let pmRelation = PoolMarketRelation.load(id);

  if (!pmRelation) {
    pmRelation = createPoolMarketRelation(id, event.params.riskPool, aggPool.market, aggPool.id);
  }

  pmRelation.capacityAllowance = event.params.capacityAllowance;

  pmRelation.save();

  if (
    pmRelation.capacityAllowance == BigInt.fromI32(0) &&
    pmRelation.poolCapacityLimit == BigInt.fromI32(0) &&
    pmRelation.marketCapacityLimit == BigInt.fromI32(0)
  ) {
    store.remove("PoolMarketRelation", id);
  }
}

export function handleLogAggregatedPoolRiskPoolCapacityLimitUpdated(
  event: LogAggregatedPoolRiskPoolCapacityLimitUpdated
): void {
  let aggPool = AggregatedPool.load(event.params.aggregatedPoolId.toString());

  if (!aggPool) {
    return;
  }

  let id = event.params.riskPool.toHexString() + "-" + aggPool.id;
  let pmRelation = PoolMarketRelation.load(id);

  if (!pmRelation) {
    pmRelation = createPoolMarketRelation(id, event.params.riskPool, aggPool.market, aggPool.id);
  }

  pmRelation.poolCapacityLimit = event.params.capacityLimit;

  pmRelation.save();

  if (
    pmRelation.capacityAllowance == BigInt.fromI32(0) &&
    pmRelation.poolCapacityLimit == BigInt.fromI32(0) &&
    pmRelation.marketCapacityLimit == BigInt.fromI32(0)
  ) {
    store.remove("PoolMarketRelation", id);
  }
}

export function handleLogAggregatedPoolMarketCapacityLimitUpdated(
  event: LogAggregatedPoolMarketCapacityLimitUpdated
): void {
  let aggPool = AggregatedPool.load(event.params.aggregatedPoolId.toString());

  if (!aggPool) {
    return;
  }

  let id = event.params.riskPool.toHexString() + "-" + aggPool.id;
  let pmRelation = PoolMarketRelation.load(id);

  if (!pmRelation) {
    pmRelation = createPoolMarketRelation(id, event.params.riskPool, aggPool.market, aggPool.id);
  }

  pmRelation.marketCapacityLimit = event.params.capacityLimit;

  pmRelation.save();

  if (
    pmRelation.capacityAllowance == BigInt.fromI32(0) &&
    pmRelation.poolCapacityLimit == BigInt.fromI32(0) &&
    pmRelation.marketCapacityLimit == BigInt.fromI32(0)
  ) {
    store.remove("PoolMarketRelation", id);
  }
}

export function handleLogRebalance(event: LogRebalance): void {
  let aggPool = AggregatedPool.load(event.params.aggregatedPoolId.toString());

  if (!aggPool) {
    return;
  }

  let id = event.params.riskPool.toHexString() + "-" + aggPool.id;
  let pmRelation = PoolMarketRelation.load(id);

  if (!pmRelation) {
    pmRelation = createPoolMarketRelation(id, event.params.riskPool, aggPool.market, aggPool.id);
  }

  pmRelation.balance = event.params.riskPoolCapacity;
  pmRelation.save();

  aggPool.totalCapacity = event.params.totalAggregatedPoolCapacity;
  aggPool.rate = getAggPoolCurrentRate(aggPool);

  aggPool.save();

  addEvent(
    EventType.PoolReBalance,
    event,
    aggPool.market,
    aggPool.id,
    pmRelation.pool,
    aggPool.coverage.toString(),
    pmRelation.balance.toString(),
    aggPool.totalCapacity.toString()
  );
}

export function handleLogRiskPoolRemovedFromAggregatedPool(
  event: LogRiskPoolRemovedFromAggregatedPool
): void {
  let aggPool = AggregatedPool.load(event.params.aggregatedPoolId.toString())!;

  let pool = Pool.load(event.params.riskPool.toHexString());

  if (!pool) {
    return;
  }

  pool.markets = filterNotEqual(pool.markets, aggPool.market);

  pool.save();

  aggPool.poolList = filterNotEqual(aggPool.poolList, pool.id);

  aggPool.save();

  addEvent(
    EventType.PoolMarketCount,
    event,
    aggPool.market,
    pool.id,
    pool.markets.length.toString()
  );
}

export function handleLogRiskPoolAddedToAggregatedPool(
  event: LogRiskPoolAddedToAggregatedPool
): void {
  let aggPool = AggregatedPool.load(event.params.aggregatedPoolId.toString());

  if (!aggPool) {
    return;
  }

  let id = event.params.riskPool.toHexString() + "-" + aggPool.id;
  let pmRelation = PoolMarketRelation.load(id);

  if (!pmRelation) {
    pmRelation = createPoolMarketRelation(id, event.params.riskPool, aggPool.market, aggPool.id);

    pmRelation.save();
  }

  let pool = Pool.load(event.params.riskPool.toHexString());

  if (!pool) {
    return;
  }

  pool.markets = addToList(pool.markets, aggPool.market);

  pool.save();

  aggPool.poolList = addToList(aggPool.poolList, pool.id);

  aggPool.save();

  addEvent(
    EventType.PoolMarketCount,
    event,
    aggPool.market,
    pool.id,
    aggPool.poolList.length.toString()
  );
}

export function handleLogRiskPoolManagerChanged(
  event: LogRiskPoolManagerChanged
): void {
  let pool = Pool.load(event.params.riskPool.toHexString())!;

  pool.manager = event.params.manager;

  pool.save();
}

export function handleLogRiskPoolManagerFeeChanged(
  event: LogRiskPoolManagerFeeChanged
): void {
  let pool = Pool.load(event.params.riskPool.toHexString())!;

  pool.managerFee = event.params.managerFee;

  pool.save();
}

export function handleLogRiskPoolManagerFeeRecipientChanged(
  event: LogRiskPoolManagerFeeRecipientChanged
): void {
  let pool = Pool.load(event.params.riskPool.toHexString())!;

  updateFeeRecipientRelation(event.params.managerFeeRecipient, event.params.riskPool, pool.feeRecipient);

  pool.feeRecipient = event.params.managerFeeRecipient;

  pool.save();
}

export function handleLogRiskTowerLevelCreated(
  event: LogRiskTowerLevelCreated1
): void {
  let id = event.params.riskTowerLevelId.toString();
  let prevId = event.params.priorRiskTowerLevel.toString();
  let level = new RiskTowerLevel(id);
  let marketId =
    event.address.toHexString() + "-" + event.params.marketId.toString();
  let levelNo = 1;

  level.market = marketId;

  if (prevId !== "0") {
    level.prevLevel = prevId;

    let prevLevel = RiskTowerLevel.load(prevId);

    if (prevLevel) {
      let oldNextLevel = prevLevel.nextLevel;

      prevLevel.nextLevel = id;

      levelNo = prevLevel.levelNo + 1;

      prevLevel.save();

      let nextLevel = oldNextLevel ? RiskTowerLevel.load(oldNextLevel) : null;

      if (nextLevel) {
        nextLevel.prevLevel = id;

        nextLevel.save();
      }
    }
  }

  level.levelNo = levelNo;

  level.save();

  let nextLevel = level.nextLevel
    ? RiskTowerLevel.load(level.nextLevel!)
    : null;

  while (nextLevel) {
    nextLevel.levelNo = nextLevel.levelNo + 1;

    nextLevel.save();

    nextLevel = nextLevel.nextLevel
      ? RiskTowerLevel.load(nextLevel.nextLevel!)
      : null;
  }
}

export function handleLogRiskTowerLevelRemoved(
  event: LogRiskTowerLevelRemoved
): void {
  let id = event.params.riskTowerLevelId.toString();
  let level = RiskTowerLevel.load(id);

  if (!level) {
    return;
  }

  let prevLevel = level.prevLevel
    ? RiskTowerLevel.load(level.prevLevel!)
    : null;
  let nextLevel = level.nextLevel
    ? RiskTowerLevel.load(level.nextLevel!)
    : null;

  if (prevLevel) {
    prevLevel.nextLevel = level.nextLevel;

    prevLevel.save();
  }

  if (nextLevel) {
    nextLevel.prevLevel = level.prevLevel;

    nextLevel.save();
  }

  store.remove("RiskTowerLevel", id);

  while (nextLevel) {
    nextLevel.levelNo = nextLevel.levelNo - 1;

    nextLevel.save();

    nextLevel = nextLevel.nextLevel
      ? RiskTowerLevel.load(nextLevel.nextLevel!)
      : null;
  }
}

export function handleLogAggregatedPoolCreated(
  event: LogAggregatedPoolCreated
): void {
  let aggPool = new AggregatedPool(event.params.aggregatedPoolId.toString());
  let marketId =
    event.address.toHexString() + "-" + event.params.marketId.toString();

  aggPool.market = marketId;
  aggPool.riskTowerLevel = event.params.riskTowerLevelId.toString();
  aggPool.premiumRateModel = event.params.premiumRateModel;
  aggPool.rate = BigInt.fromI32(0);
  aggPool.totalCapacity = BigInt.fromI32(0);
  aggPool.coverage = BigInt.fromI32(0);
  aggPool.poolList = [];

  aggPool.save();

  let marketAggPool = MarketAggregatedPool.load(marketId);

  if (!marketAggPool) {
    marketAggPool = new MarketAggregatedPool(marketId);

    marketAggPool.list = [];
  }

  marketAggPool.list = addToList(marketAggPool.list, aggPool.id);

  marketAggPool.save();
}

export function handleLogAggregatedPoolRemoved(
  event: LogAggregatedPoolRemoved
): void {
  store.remove("AggregatedPool", event.params.aggregatedPoolId.toString());
}

function getAggPoolCurrentRate(aggPool: AggregatedPool): BigInt {
  let premiumRateModel = PremiumRateModelContract.bind(
    changetype<Address>(aggPool.premiumRateModel)
  );
  let rate = premiumRateModel.try_getPremiumRate(
    aggPool.totalCapacity,
    aggPool.coverage
  );

  return rate.reverted ? BigInt.fromI32(0) : rate.value;
}

export function updateMarketChargeState(
  rpcContractAddress: Address,
  marketId: string,
  event: ethereum.Event,
): void {
  let rpcContract = RiskPoolsControllerContract.bind(rpcContractAddress);
  let market = Market.load(marketId)!;

  market.premiumMulAccumulator = rpcContract.marketsPremiumMulAccumulators(
    market.marketId
  );

  const marketMeta = getMarketMeta(rpcContract, market.marketId);

  const coverDetails = getMarketCoverDetails(rpcContract, market.marketId);

  const oldCover = market.exposure;

  market.latestAccruedTimestamp = marketMeta.accrualBlockNumberPrior;
  market.exposure = marketMeta.desiredCover;
  market.actualCover = coverDetails.actualCover;

  market.save();

  updateState(
    EventType.SystemExposure,
    market.exposure.minus(oldCover),
    null,
    market.capitalToken.toHexString()
  );

  const coverMap = new Map<string, BigInt>();

  for (let i = 0; i < coverDetails.aggregatedPools.length; i++) {
    coverMap.set(coverDetails.aggregatedPools[i].toString(), coverDetails.covers[i]);
  }

  const marketAggPool = MarketAggregatedPool.load(market.id);

  if (!marketAggPool) {
    return;
  }

  for (let i = 0; i < marketAggPool.list.length; i++) {
    const aggPoolId = marketAggPool.list[i];
    const aggPool = AggregatedPool.load(aggPoolId);

    if (!aggPool) {
      continue;
    }

    let poolCover = BigInt.fromI32(0);

    if (coverMap.has(aggPoolId)) {
      poolCover = coverMap.get(aggPoolId);
    }

    updateAggPoolCover(event, aggPool, poolCover);
  }
}

function createPoolMarketRelation(
  id: string,
  poolId: Address,
  marketId: string,
  aggPoolId: string
): PoolMarketRelation {
  let pmr = new PoolMarketRelation(id);

  pmr.poolId = poolId;
  pmr.pool = poolId.toHexString();
  pmr.market = marketId;
  pmr.balance = BigInt.fromI32(0);
  pmr.capacityAllowance = BigInt.fromI32(0);
  pmr.poolCapacityLimit = BigInt.fromI32(0);
  pmr.marketCapacityLimit = BigInt.fromI32(0);
  pmr.aggregatedPool = aggPoolId;

  return pmr;
}
