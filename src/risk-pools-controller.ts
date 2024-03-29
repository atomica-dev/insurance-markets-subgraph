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
  LogSwapped,
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
  LogRiskPoolAddedToAggregatedPool,
  LogRiskPoolRemovedFromAggregatedPool,
  LogRebalance,
  LogRiskPoolOperatorChanged,
  LogRiskPoolOperatorFeeChanged,
  LogRiskPoolOwnerChanged,
  LogCoverMiningRewardArchived,
  LogCoverMiningRewardDeactivated,
  LogArchivedRewardClaimed,
  LogWithdrawAccruedMarketFee,
  LogPremiumEarned,
  LogCoverDistributed,
  LogNewPolicy,
  LogJoinMarket,
  LogListCreated,
  LogListEdited,
  LogListEditorChanged,
  LogMarketCapacityAllowanceUpdated,
  LogMarketCapacityLimitUpdated,
  LogPayoutRequestApproved,
  LogPayoutRequestDeclined,
  RiskPoolsController as RiskPoolsControllerContract,
  LogNewMarketCreated,
  LogProductChanged,
  LogPermissionTokenRevoked,
  LogExecutionDelayed,
  LogExecuted,
  LogExecutionDeclined,
  LogLoanRequested,
  LogLoanApproved,
  LogLoanRequestDeclined,
  LogLoanDataUpdated,
  LogLoanPrincipalRepaid,
  LogLoanTransferred,
  LogLoanInterestCharged,
  LogLoanInterestPaid,
  LogLoanRequestClosed,
  LogLoanRequestModified,
  LogPolicyCoverDelegationUpdated,
  LogPolicyCoverDelegationOperatorUpdated,
} from "../generated/RiskPoolsController/RiskPoolsController";
import { PolicyPermissionTokenIssuer, PolicyTokenIssuer, PayoutRequester as PayoutRequesterTemplate } from "../generated/templates";
import {
  Market,
  Policy,
  PolicyPermissionToken,
  Pool,
  Product,
  AccruedFee,
  MarketAccruedFee,
  Swap,
  SwapDetail,
  Payout,
  PayoutRequest,
  IncomingPayoutRequest,
  CoverMiningReward,
  CoverMiningRewardClaim,
  AggregatedPool,
  PoolFee,
  MarketPoolFee,
  FeeRecipientPool,
  AllowList,
  AllowListAccount,
  Bid,
  DelayedExecution,
  DelayedExecutionHistory,
  LoanRequest,
  Loan,
  LoanChunk,
  LoanPayment,
} from "../generated/schema";
import { addEvent, EventType, getState, StatusEnum, updateAndLogState, updateState, updateSystemStatus } from "./event";
import { Address, BigInt, Bytes, DataSourceContext, bigInt, ethereum, log, store } from "@graphprotocol/graph-ts";
import { Pool as PoolContract } from "../generated/RiskPoolsController/Pool";
import { PolicyTokenIssuer as PolicyTokenIssuerContract } from "../generated/RiskPoolsController/PolicyTokenIssuer";
import { getSystemConfig } from "./system";
import {
  CLoanChunk,
  CPolicy,
  getAggregatedPool,
  getCoverReward,
  getForwardedPayoutRequest,
  getList,
  getLoan,
  getLoanChunk,
  getLoanRequest,
  getMarket,
  getMarketMeta,
  getPayoutRequest,
  getPolicy,
  getPolicyCoverDelegation,
  getPolicyDeposit,
  getProduct,
  getProductMeta,
  getRiskPoolData,
} from "./contract-mapper";
import { claimAllTypeFees, updateAllTypeFees } from "./fee";
import { GovernanceOperationMap } from "./governance-operations";
import { addToList, addUniqueToList, ETH_ADDRESS, filterNotEqual, WEI_BIGINT, ZERO_ADDRESS } from "./utils";
import { addOraclePair } from "./rate-oracle";
import { Pool as PoolTemplate } from "../generated/templates";
import { ProductOperatorLogType } from "./product-operator-log-type.enum";
import { SettlementType } from "./settlement-type.enum";
import { RPC_CONTRACT_ADDRESS_CONTEXT_KEY } from "./payout-requester";
import { getMarketRateAndActualCover } from "./market-rate-utils";
import { LoanRequestStatusEnum } from "./loan-request-status.enum";

export function handleLogNewMarket(event: LogNewMarketCreated): void {
  let marketId = event.params.marketId;
  let productId = `${event.address.toHexString()}-${event.params.productId.toString()}`;
  let product = Product.load(productId)!;
  let rpcContractAddress = changetype<Address>(product.riskPoolsControllerAddress);
  let rpcContract = RiskPoolsControllerContract.bind(rpcContractAddress);

  let id = rpcContractAddress.toHexString() + "-" + marketId.toString();
  let market = new Market(id);
  let marketInfo = getMarket(rpcContract, marketId);
  let marketMeta = getMarketMeta(rpcContract, marketId);
  let productMeta = getProductMeta(rpcContract, event.params.productId);
  let titleParams = marketInfo.title.split("+");

  market.marketId = marketId;
  market.product = productId;
  market.productId = event.params.productId;
  market.riskPoolsControllerAddress = rpcContractAddress;

  market.wording = productMeta.wording;
  market.entityList = titleParams;
  market.details = marketInfo.details;
  market.data = marketInfo.data;

  market.waitingPeriod = marketMeta.waitingPeriod;
  market.operatorFee = marketMeta.marketOperatorIncentiveFee;
  market.latestAccruedTimestamp = marketMeta.lastChargeTimestamp;
  market.settlementDiscount = marketMeta.settlementDiscount;

  market.operator = marketInfo.operator;
  market.owner = marketInfo.owner;
  market.premiumToken = marketInfo.premiumToken;
  market.capitalToken = marketInfo.capitalToken;
  market.insuredToken = marketInfo.insuredToken;
  market.coverAdjusterOracle = marketInfo.coverAdjusterOracle;
  market.rateOracle = marketInfo.ratesOracle;
  market.title = marketInfo.title;
  market.isEnabled = rpcContract.marketStatus(marketId) == 0;

  market.desiredCover = marketMeta.desiredCover;
  market.waitingPeriod = marketMeta.waitingPeriod;
  market.withdrawDelay = marketMeta.withdrawDelay;
  market.headAggregatedPoolId = marketMeta.headAggregatedPoolId;
  market.tailCover = marketMeta.tailCover;
  market.minPremiumRatePerSec = marketMeta.minPremiumRatePerSec;
  market.maxPremiumRatePerSec = marketMeta.maxPremiumRatePerSec;
  market.bidStepPremiumRatePerSec = marketMeta.bidStepPremiumRatePerSec;
  market.maxAggregatedPoolSlots = marketMeta.maxAggregatedPoolSlots;
  market.tailKink = marketMeta.tailKink;
  market.tailJumpPremiumRatePerSec = marketMeta.tailJumpPremiumRatePerSec;

  market.policyBuyerAllowListId = rpcContract.policyBuyerAllowlistId(marketId);
  market.policyBuyerAllowanceListId = rpcContract.policyBuyerAllowanceListId(marketId);
  market.premiumMulAccumulator = rpcContract.marketsPremiumMulAccumulators(marketId);
  market.createdAt = event.block.timestamp;

  market.payoutRequester = marketInfo.payoutRequester;
  market.payoutApprover = marketInfo.payoutApprover;

  market.status = StatusEnum.Opened;

  market.save();

  createAggregatedPool(market.headAggregatedPoolId, rpcContractAddress);

  if (market.rateOracle) {
    addOraclePair(market.rateOracle.toHexString(), market.capitalToken, market.premiumToken);
    addOraclePair(market.rateOracle.toHexString(), market.premiumToken, Address.fromHexString(ETH_ADDRESS));

    if (market.insuredToken != Address.fromHexString(ZERO_ADDRESS)) {
      addOraclePair(market.rateOracle.toHexString(), market.capitalToken, market.insuredToken);
    }
  }

  updateAndLogState(EventType.TotalMarkets, event, BigInt.fromI32(1), null);
  addEvent(EventType.NewMarket, event, id, market.title);
}

export function createPool(poolId: Address, event: ethereum.Event): void {
  let pool = new Pool(poolId.toHexString());
  let pContract = PoolContract.bind(poolId);
  let btContract = PoolContract.bind(pContract.assetToken()); // It is also ERC20
  let rpcContract = RiskPoolsControllerContract.bind(pContract.controller());
  let riskPoolData = getRiskPoolData(rpcContract, poolId);

  pool.riskPoolsControllerAddress = pContract.controller();
  pool.name = pContract.name();
  pool.capitalTokenAddress = pContract.assetToken();
  pool.nominatedTokenAddress = riskPoolData.nominatedToken;
  pool.capitalTokenBalance = BigInt.fromI32(1);
  pool.poolTokenBalance = BigInt.fromI32(1);
  pool.participants = BigInt.fromI32(0);
  pool.createdAt = event.block.timestamp;
  pool.createdBy = event.transaction.from;
  pool.operator = riskPoolData.operator;
  pool.owner = riskPoolData.owner;
  pool.updatedAt = event.block.timestamp;
  pool.poolTokenDecimals = !pContract.try_decimals().reverted ? pContract.try_decimals().value : 18;
  pool.poolTokenSymbol = !pContract.try_symbol().reverted ? pContract.try_symbol().value : "";
  pool.operatorFee = riskPoolData.operatorFee;
  pool.agreement = riskPoolData.agreement;
  pool.details = riskPoolData.details;
  pool.data = riskPoolData.data;
  pool.capitalTokenDecimals = !btContract.try_decimals().reverted ? btContract.try_decimals().value : 18;
  pool.capitalTokenSymbol = !btContract.try_symbol().reverted ? btContract.try_symbol().value : "";
  pool.capitalRequirement = pContract.cap();
  pool.markets = [];
  pool.withdrawRequestExpiration = pContract.withdrawRequestExpiration();
  pool.withdrawDelay = pContract.withdrawDelay();
  pool.lpAllowListId = pContract.allowlistId();
  pool.lpAllowanceListId = pContract.allowanceListId();
  pool.rewards = [];
  pool.externalPoolList = [];
  pool.externalCapacity = BigInt.fromI32(0);
  pool.totalTransferredOut = BigInt.fromI32(0);
  pool.physicalSettlementMarketCount = 0;
  pool.released = BigInt.fromI32(0);
  pool.reserveRatio = pContract.reserveRatio();
  pool.withdrawProcedure = pContract.withdrawProcedure();

  pool.save();

  updateFeeRecipientRelation(pool.owner, poolId);

  PoolTemplate.create(poolId);

  addEvent(
    EventType.PoolBalance,
    event,
    null,
    pool.id,
    pool.poolTokenBalance.toString(),
    pool.capitalTokenBalance.toString(),
    pool.poolTokenBalance.toString(),
  );
  updateState(EventType.SystemPoolCount, BigInt.fromI32(1), null);
}

export function updateFeeRecipientRelation(feeRecipientId: Bytes, riskPoolId: Bytes, oldFeeRecipient: Bytes | null = null): void {
  let id = feeRecipientId.toHexString();
  let frp = FeeRecipientPool.load(id);

  if (!frp) {
    frp = new FeeRecipientPool(id);
    frp.poolList = [];
  }

  frp.poolList = addUniqueToList(frp.poolList, riskPoolId.toHexString());

  frp.save();

  if (oldFeeRecipient) {
    let frp = FeeRecipientPool.load(oldFeeRecipient.toHexString());

    if (!frp) {
      return;
    }

    frp.poolList = filterNotEqual(frp.poolList, riskPoolId.toHexString());

    frp.save();
  }
}

export function handleLogNewPolicy(event: LogNewPolicy): void {
  let policyId = event.params.policyId;
  let rpcContract = RiskPoolsControllerContract.bind(event.address);
  let piContract = PolicyTokenIssuerContract.bind(rpcContract.policyTokenIssuer());
  let policyInfo = getPolicy(rpcContract, policyId);
  let marketInfo = getMarket(rpcContract, event.params.marketId);
  let policyBalance = rpcContract.policyBalance(policyId, marketInfo.premiumToken);
  let depositInfo = getPolicyDeposit(rpcContract, policyId, marketInfo.premiumToken);

  let id = rpcContract.policyTokenIssuer().toHexString() + "-" + policyId.toString();
  let policy = new Policy(id);
  let productId = `${event.address.toHexString()}-${marketInfo.productId.toString()}`;

  policy.policyTokenIssuerAddress = rpcContract.policyTokenIssuer();
  policy.policyId = policyId;
  policy.product = productId;
  policy.productId = marketInfo.productId;
  policy.originalBalance = depositInfo.premiumFeeDeposit.plus(depositInfo.frontendOperatorFeeDeposit).plus(depositInfo.referralFeeDeposit);
  policy.balance = policyBalance;
  policy.premiumDeposit = depositInfo.premiumFeeDeposit;
  policy.foFeeDeposit = depositInfo.frontendOperatorFeeDeposit;
  policy.initialMarketPremiumMulAccumulator = depositInfo.premiumMulAccumulator;
  policy.referralFeeDeposit = depositInfo.referralFeeDeposit;

  policy.marketId = policyInfo.marketId;
  policy.market = event.address.toHexString() + "-" + policyInfo.marketId.toString();
  policy.validUntil = policyInfo.validUntil;
  policy.validFrom = event.block.timestamp;
  policy.coverageChanged = policyInfo.coverChanged;
  policy.issuer = event.transaction.from.toHexString();
  policy.owner = piContract.ownerOf(policyId).toHexString();
  policy.waitingPeriod = policyInfo.waitingPeriod;
  policy.frontendOperator = policyInfo.frontendOperator.toHexString();
  policy.foAddress = policyInfo.frontendOperator;
  policy.foFeeRate = policyInfo.frontendOperatorFee;
  policy.referralBonus = policyInfo.referralBonus;
  policy.referralAddress = policyInfo.referral;
  policy.referralFeeRate = policyInfo.referralFee;
  policy.coverage = policyInfo.desiredCover;
  policy.underlyingCover = policyInfo.underlyingCover;
  policy.expired = policy.coverage.equals(BigInt.fromI32(0));

  policy.totalCharged = BigInt.fromI32(0);

  policy.updatedAt = event.block.timestamp;

  policy.save();

  if (getState(EventType.TotalPolicies, policy.market).value == BigInt.fromI32(0)) {
    // Until contract issue is fixed it's required to call update coverage manually.
    updateMarketChargeState(event.address, policy.market, event);
  }

  addEvent(EventType.NewPolicy, event, policy.market, policy.id, policy.balance.toString(), policy.coverage.toString());
  updateAndLogState(EventType.TotalPolicies, event, BigInt.fromI32(1), policy.market);
  updateAndLogState(EventType.MarketExposure, event, policy.coverage, policy.market);

  updateAndLogState(EventType.MarketPolicyPremium, event, policy.premiumDeposit, policy.market);
}

export function handleLogProductChanged(event: LogProductChanged): void {
  let productId = `${event.address.toHexString()}-${event.params.productId.toString()}`;
  let product = Product.load(productId)!;

  switch (event.params.logType) {
    case ProductOperatorLogType.MarketCreationFeeToken:
      product.feeToken = event.params.param1;

      break;
    case ProductOperatorLogType.MarketCreationFee:
      product.marketCreationFeeAmount = event.params.param2;

      break;
    case ProductOperatorLogType.DefaultRatesOracle:
      product.defaultRatesOracle = event.params.param1;

      break;
    case ProductOperatorLogType.WithdrawDelay:
      product.withdrawalDelay = event.params.param2;

      break;
    case ProductOperatorLogType.WithdrawRequestExpiration:
      product.withdrawRequestExpiration = event.params.param2;

      break;
    case ProductOperatorLogType.WaitingPeriod:
      product.waitingPeriod = event.params.param2;

      break;
    case ProductOperatorLogType.CoverAdjusterOracle:
      product.defaultCoverAdjusterOracle = event.params.param1;

      break;
    case ProductOperatorLogType.DefaultCapitalToken:
      product.defaultCapitalToken = event.params.param1;

      break;
    case ProductOperatorLogType.DefaultPremiumToken:
      product.defaultPremiumToken = event.params.param1;

      break;
    case ProductOperatorLogType.ClaimProcessor:
      product.claimProcessor = event.params.param1;

      break;
    case ProductOperatorLogType.PayoutRequester:
      product.payoutRequester = event.params.param1;

      break;
    case ProductOperatorLogType.PayoutApprover:
      product.payoutApprover = event.params.param1;

      break;
    case ProductOperatorLogType.MarketCreatorsAllowlistId:
      product.marketCreatorsAllowlistId = event.params.param2;

      break;

    default:
      log.error("Unknown product prop change {}", [event.params.logType.toString()]);
  }

  product.updatedAt = event.block.timestamp;

  product.save();

  addEvent(
    event.params.logType,
    event,
    null,
    event.address.toHexString(),
    event.params.param1.toHexString() != ZERO_ADDRESS ? event.params.param1.toHexString() : event.params.param2.toString(),
  );
}

export function handleLogNewProduct(event: LogNewProduct): void {
  getState(EventType.SystemStatus).save();
  getSystemConfig(event.address.toHexString());

  let productId = `${event.address.toHexString()}-${event.params.productId.toString()}`;
  let rpcContract = RiskPoolsControllerContract.bind(event.address);

  let productInfo = getProduct(rpcContract, event.params.productId);
  let productMeta = getProductMeta(rpcContract, event.params.productId);
  let product = new Product(productId);

  product.productId = event.params.productId;
  product.riskPoolsControllerAddress = event.address;
  product.policyTokenIssuerAddress = rpcContract.policyTokenIssuer();
  product.title = productMeta.title;
  product.claimProcessor = productInfo.claimProcessor;
  product.treasuryAddress = rpcContract.treasury();
  product.wording = productMeta.wording;
  product.details = productMeta.details;
  product.settlementType = productMeta.settlement;
  product.data = productMeta.data;
  product.cashSettlementIsEnabled = productMeta.settlement == SettlementType.Cash;
  product.physicalSettlementIsEnabled = productMeta.settlement == SettlementType.Physical;
  product.feeToken = productInfo.marketCreationFeeToken;
  product.marketCreationFeeAmount = productMeta.marketCreationFee;
  product.defaultPremiumToken = productInfo.defaultPremiumToken;
  product.defaultCapitalToken = productInfo.defaultCapitalToken;
  product.defaultCoverAdjusterOracle = productInfo.defaultCoverAdjusterOracle;
  product.payoutApprover = productInfo.payoutApprover;
  product.payoutRequester = productInfo.payoutRequester;
  product.operatorFee = productMeta.productOperatorIncentiveFee;
  product.owner = productInfo.owner;
  product.maxMarketIncentiveFee = productMeta.maxMarketOperatorIncentiveFee;

  product.defaultRatesOracle = productInfo.defaultRatesOracle;
  product.withdrawalDelay = productMeta.withdrawDelay;
  product.withdrawRequestExpiration = productMeta.withdrawRequestExpiration;
  product.waitingPeriod = productMeta.waitingPeriod;
  product.marketCreatorsAllowlistId = productMeta.marketCreatorsListId;
  product.operator = productInfo.operator;

  product.createdAt = event.block.timestamp;
  product.createdBy = event.transaction.from;
  product.updatedAt = event.block.timestamp;
  product.status = productMeta.status;

  product.save();

  let context = new DataSourceContext();

  context.setString(RPC_CONTRACT_ADDRESS_CONTEXT_KEY, event.address.toHexString());

  PolicyTokenIssuer.create(rpcContract.policyTokenIssuer());
  PolicyPermissionTokenIssuer.create(rpcContract.policyTokenPermissionIssuer());
  PayoutRequesterTemplate.createWithContext(changetype<Address>(product.claimProcessor), context);

  updateState(EventType.SystemProductCount, BigInt.fromI32(1), null);

  addEvent(EventType.NewProduct, event, null, product.id);
}

export function handleLogLiquidation(event: LogLiquidation): void {
  let rpcContract = RiskPoolsController.bind(event.address);
  let id = rpcContract.policyTokenIssuer().toHexString() + "-" + event.params.policyId.toString();

  updatePolicy(id, event.address, event);
}

function updatePolicyCoverage(policy: Policy, cPolicy: CPolicy, event: ethereum.Event): void {
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

    updateAndLogState(EventType.TotalPolicies, event, BigInt.fromI32(-1), policy.market);
  }

  updateAndLogState(EventType.MarketExposure, event, policy.coverage.minus(oldCoverage), policy.market);
}

export function handleLogPolicyCoverChanged(event: LogPolicyCoverChanged): void {
  let rpcContract = RiskPoolsController.bind(event.address);
  let id = rpcContract.policyTokenIssuer().toHexString() + "-" + event.params.policyId.toString();

  updatePolicy(id, event.address, event);
}

export function handleLogNewPool(event: LogNewPool): void {
  let poolId = event.params.newPool;

  createPool(poolId, event);
}

export function marketPremiumEarned(marketId: string, premium: BigInt, token: Address, event: ethereum.Event): void {
  updatePolicyBalances(marketId, token);
  updateAndLogState(EventType.MarketEarnedPremium, event, premium, marketId);
}

export function handleLogMarketStatusChanged(event: LogMarketStatusChanged): void {
  let id = event.address.toHexString() + "-" + event.params.marketId.toString();

  let market = Market.load(id)!;

  market.isEnabled = event.params.enabled;

  market.save();
}

function updatePolicyBalances(marketId: string, backTokenAddress: Address): void {
  let market = Market.load(marketId)!;

  let rpcContract = RiskPoolsControllerContract.bind(changetype<Address>(market.riskPoolsControllerAddress));

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
    let result = rpcContract.try_policyBalance(policy.policyId, backTokenAddress);
    let balance = !result.reverted ? result.value : BigInt.fromI32(0);

    policy.balance = balance;
    policy.totalCharged = policy.originalBalance.minus(balance);

    policy.save();

    totalCharged = totalCharged.plus(oldBalance).minus(policy.balance);
  }

  updateState(EventType.SystemPremiumEarned, totalCharged, null, backTokenAddress.toHexString());
}

export function handleLogGovernance(event: LogGovernance): void {
  if (GovernanceOperationMap.has(event.params.logType)) {
    GovernanceOperationMap.get(event.params.logType)(event);

    return;
  }

  log.warning("Unknown governance update {}", [event.params.logType.toString()]);
}

export function handleLogNewSystemStatus(event: LogNewSystemStatus): void {
  updateSystemStatus(event.params.status);

  let config = getSystemConfig(event.address.toHexString());

  config.status = event.params.status;

  config.save();
}

export function handleLogNewProductStatus(event: LogNewProductStatus): void {
  let productId = `${event.address.toHexString()}-${event.params.productId.toString()}`;
  let product = Product.load(productId);

  if (!product) {
    return;
  }

  product.status = event.params.status;

  product.save();

  addEvent(EventType.ProductStatus, event, null, productId, event.params.status.toString());
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

export function handleLogPermissionTokenIssued(event: LogPermissionTokenIssued): void {
  let pToken = new PolicyPermissionToken(event.params.permissionId.toString());
  let rpcContract = RiskPoolsControllerContract.bind(event.address);

  pToken.policyId = event.params.policyId;
  pToken.policy = rpcContract.policyTokenIssuer().toHexString() + "-" + event.params.policyId.toString();
  pToken.owner = event.params.receiver;

  pToken.save();
}

export function handleLogPermissionTokenRevoked(event: LogPermissionTokenRevoked): void {
  store.remove("PolicyPermissionToken", event.params.permissionId.toString());
}

export function handleLogPolicyDeposit(event: LogPolicyDeposit): void {
  let rpcContract = RiskPoolsControllerContract.bind(event.address);
  let id = rpcContract.policyTokenIssuer().toHexString() + "-" + event.params.policyId.toString();
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
  updateAndLogState(EventType.MarketPolicyPremium, event, event.params.premiumFeeDeposit, policy.market);
}

function loadPolicyByRpc(rpcAddress: Address, policyId: BigInt): Policy | null {
  let rpcContract = RiskPoolsControllerContract.bind(rpcAddress);
  let id = rpcContract.policyTokenIssuer().toHexString() + "-" + policyId.toString();

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
  updateAndLogState(EventType.MarketPolicyPremium, event, event.params.withdrawnPremiumFeeDeposit.neg(), policy.market);
}

function updatePolicy(id: string, rpcAddress: Address, event: ethereum.Event): void {
  let policy = Policy.load(id)!;

  let rpcContract = RiskPoolsControllerContract.bind(rpcAddress);
  let market = Market.load(policy.market)!;
  let result = rpcContract.try_policyBalance(policy.policyId, changetype<Address>(market.premiumToken));
  let pInfo = getPolicyDeposit(rpcContract, policy.policyId, changetype<Address>(market.premiumToken));
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

  increaseFeeRecipientBalance(event.params.frontendOperatorFeeRecipient, event.params.premiumToken, event.params.frontendOperatorFee, policy.market);
  increaseFeeRecipientBalance(event.params.referralFeeRecipient, event.params.premiumToken, event.params.referralFee, policy.market);

  updatePolicy(policy.id, event.address, event);
}

function increaseFeeRecipientBalance(recipient: Address, token: Address, amount: BigInt, marketId: string): void {
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
    maf.claimedBalance = BigInt.fromI32(0);
    maf.claimedIndicator = af.claimedBalance;
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
  let id = event.params.requester.toHexString() + "-" + event.params.erc20.toHexString();
  let af = AccruedFee.load(id);

  if (!af) {
    return;
  }

  af.balance = af.balance.minus(event.params.amount);
  af.claimedBalance = af.claimedBalance.plus(event.params.amount);

  af.save();
}

export function handleLogSwapped(event: LogSwapped): void {
  let id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let s = new SwapDetail(id.toString());

  s.recipient = event.params.recipient;
  s.riskPool = event.params.riskPool;
  s.insuredToken = event.params.insuredToken;
  s.insuredTokenSwappedAmount = event.params.insuredTokenSwappedAmount;
  s.assetToken = event.params.assetToken;
  s.assetTokenSwappedAmount = event.params.assetTokenSwappedAmount;
  s.createdAt = event.block.timestamp;
  s.transaction = event.transaction.hash;

  s.save();
}

export function handleLogSwap(event: LogSwap): void {
  let id = updateState(EventType.SwapCount, BigInt.fromI32(1), "");
  let rpcContract = RiskPoolsController.bind(event.address);
  let policyId = rpcContract.policyTokenIssuer().toHexString() + "-" + event.params.policyId.toString();
  let policy = Policy.load(policyId)!;

  let s = new Swap(id.toString());

  s.policyId = event.params.policyId;
  s.insuredToken = event.params.insuredToken;
  s.capitalToken = event.params.capitalToken;
  s.swapAmount = event.params.insuredTokenSwapped;
  s.swapCover = event.params.marketCapitalTokenCoverSwapped;
  s.recipient = event.params.recipient;
  s.createdAt = event.block.timestamp;
  s.transaction = event.transaction.hash;
  s.market = policy.market;

  s.save();

  updatePolicy(policyId, event.address, event);
}

export function handleLogPayout(event: LogPayout): void {
  let id = updateState(EventType.PayoutCount, BigInt.fromI32(1), "");

  let p = new Payout(id.toString());

  p.marketId = event.params.marketId;
  p.market = event.address.toHexString() + "-" + event.params.marketId.toString();
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
  request.market = event.address.toHexString() + "-" + r.marketId.toString();
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

export function handleLogPayoutRequestApproved(event: LogPayoutRequestApproved): void {
  let rpcContract = RiskPoolsControllerContract.bind(event.address);
  let r = getPayoutRequest(rpcContract, event.params.payoutRequestId);

  let request = new PayoutRequest(event.params.payoutRequestId.toString());

  request.status = r.status;

  request.save();
}

export function handleLogPayoutRequestDeclined(event: LogPayoutRequestDeclined): void {
  let rpcContract = RiskPoolsControllerContract.bind(event.address);
  let r = getPayoutRequest(rpcContract, event.params.payoutRequestId);

  let request = new PayoutRequest(event.params.payoutRequestId.toString());

  request.status = r.status;

  request.save();
}

export function handleLogNewForwardedPayoutRequest(event: LogNewForwardedPayoutRequest): void {
  let rpcContract = RiskPoolsControllerContract.bind(event.address);

  let r = getForwardedPayoutRequest(rpcContract, event.params.payoutRequestId);

  let request = new IncomingPayoutRequest(event.params.payoutRequestId.toString());

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

export function handleLogForwardedPayoutRequestProcessed(event: LogForwardedPayoutRequestProcessed): void {
  let request = IncomingPayoutRequest.load(event.params.forwardedPayoutRequestId.toString())!;

  request.status = 2; // Processed

  request.save();
}

export function handleLogForwardedPayoutRequestDeclined(event: LogForwardedPayoutRequestDeclined): void {
  let request = IncomingPayoutRequest.load(event.params.forwardedPayoutRequestId.toString())!;

  request.status = 1; // Declined

  request.save();
}

export function handleLogNewReward(event: LogNewReward): void {
  let rpcContract = RiskPoolsControllerContract.bind(event.address);
  let reward = getCoverReward(rpcContract, event.params.rewardId);
  let cmReward = new CoverMiningReward(event.params.rewardId.toString());

  cmReward.market = event.address.toHexString() + "-" + reward.marketId.toString();
  cmReward.amount = reward.amount;
  cmReward.creator = event.transaction.from;
  cmReward.rewardToken = reward.erc20;
  cmReward.startedAt = reward.startTime;
  cmReward.endedAt = reward.endTime;
  cmReward.ratePerSecond = reward.rate;
  cmReward.updatedAt = event.block.timestamp;
  cmReward.rewardPerToken = reward.rewardPerShareStored;
  cmReward.cid = reward.cid;
  cmReward.isArchived = false;

  cmReward.save();
}

export function handleLogIncreaseRewardAmount(event: LogIncreaseRewardAmount): void {
  let cmReward = CoverMiningReward.load(event.params.rewardId.toString());

  if (!cmReward) {
    return;
  }

  cmReward.amount = cmReward.amount.plus(event.params.amount);

  cmReward.save();
}

function _claimReward(rewardId: BigInt, amount: BigInt, policyId: BigInt, from: Address, timestamp: BigInt): void {
  let cmReward = CoverMiningReward.load(rewardId.toString());

  if (!cmReward) {
    return;
  }

  cmReward.amount = cmReward.amount.minus(amount);

  cmReward.save();

  let id = from.toHexString() + "-" + rewardId.toString() + "-" + policyId.toString();
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
  _claimReward(event.params.rewardId, event.params.rewardAmount, event.params.policyId, event.transaction.from, event.block.timestamp);
}

export function handleLogArchivedRewardClaimed(event: LogArchivedRewardClaimed): void {
  _claimReward(event.params.rewardId, event.params.amount, event.params.policyId, event.transaction.from, event.block.timestamp);
}

export function handleLogCoverMiningRewardArchived(event: LogCoverMiningRewardArchived): void {
  let cmReward = CoverMiningReward.load(event.params.rewardId.toString());

  if (!cmReward) {
    return;
  }

  cmReward.isArchived = true;
  cmReward.rootHash = event.params.rootHash;
  cmReward.dataUrl = event.params.proofsCid;

  cmReward.save();
}

export function handleLogCoverMiningRewardDeactivated(event: LogCoverMiningRewardDeactivated): void {
  let cmReward = CoverMiningReward.load(event.params.rewardId.toString());

  if (!cmReward) {
    return;
  }

  cmReward.isArchived = true;

  cmReward.save();
}

export function handleLogPremiumEarned(event: LogPremiumEarned): void {
  const marketId = event.address.toHexString() + "-" + event.params.marketId.toString();

  updateMarketChargeState(event.address, marketId, event);
  updateAndLogState(EventType.MarketEarnedPremium, event, event.params.charge, marketId);
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
    let bid = Bid.load(`${aggPool.market}-${poolId}`);
    let id = poolId + "-" + token.toHexString();

    if (!bid || bid.capacity.isZero()) {
      continue;
    }

    let poolPremium = bid.capacity.times(event.params.premium).div(aggPool.totalCapacity);

    let pf = PoolFee.load(id);

    if (!pf) {
      pf = new PoolFee(id);

      pf.poolId = Address.fromHexString(poolId);
      pf.tokenId = token;
      pf.pool = poolId;
      pf.amount = BigInt.fromI32(0);
      pf.claimedAmount = BigInt.fromI32(0);
    }

    let amount = poolPremium.times(pool.operatorFee).div(WEI_BIGINT);

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
      mpf.claimedIndicator = pf.claimedAmount;
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

export function handleLogWithdrawAccruedMarketFee(event: LogWithdrawAccruedMarketFee): void {
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

export function handleLogMarketCapacityAllowanceUpdated(event: LogMarketCapacityAllowanceUpdated): void {
  let bid = getOrCreateBid(event.params.marketId, event.params.riskPool, event.address, event.block.timestamp);

  bid.capacityAllowance = event.params.capacityAllowance;

  bid.save();
}

export function handleLogMarketCapacityLimitUpdated(event: LogMarketCapacityLimitUpdated): void {
  let bid = getOrCreateBid(event.params.marketId, event.params.riskPool, event.address, event.block.timestamp);

  bid.marketCapacityLimit = event.params.capacityLimit;

  bid.save();
}

export function handleLogCoverDistributed(event: LogCoverDistributed): void {
  let aggPool = AggregatedPool.load(event.params.aggregatedPoolId.toString());

  if (!aggPool) {
    return;
  }

  const market = Market.load(aggPool.market)!;

  market.tailCover = event.params.cover;
  market.tailAggPoolId = event.params.aggregatedPoolId;

  market.save();
}

export function handleLogRebalance(event: LogRebalance): void {
  let aggPool = AggregatedPool.load(event.params.aggregatedPoolId.toString());
  let prevAggPool: AggregatedPool | null = null;
  if (!event.params.prevAggregatedPoolId.isZero() && event.params.aggregatedPoolId.notEqual(event.params.prevAggregatedPoolId)) {
    prevAggPool = AggregatedPool.load(event.params.prevAggregatedPoolId.toString());
  }

  if (!aggPool && !prevAggPool) {
    return;
  }

  const marketId = aggPool ? aggPool.market : prevAggPool!.market;
  let id = marketId + "-" + event.params.riskPool.toHexString();
  let bid = Bid.load(id);

  if (!bid) {
    return;
  }

  const prevCapacity = bid.capacity;
  bid.aggregatedPoolId = event.params.aggregatedPoolId;
  bid.aggregatedPool = aggPool ? aggPool.id : null;
  bid.capacity = event.params.riskPoolCapacity;
  bid.save();

  if (aggPool) {
    aggPool.totalCapacity = event.params.totalAggregatedPoolCapacity;
    aggPool.save();

    addEvent(
      EventType.PoolReBalance,
      event,
      aggPool.market,
      aggPool.id,
      bid.pool,
      aggPool.totalCapacity.toString(), // TODO: should be cover
      bid.capacity.toString(),
      aggPool.totalCapacity.toString(),
    );
  }
  if (prevAggPool) {
    prevAggPool.totalCapacity = prevAggPool.totalCapacity.minus(prevCapacity);
    prevAggPool.save();

    addEvent(
      EventType.PoolReBalance,
      event,
      prevAggPool.market,
      prevAggPool.id,
      bid.pool,
      prevAggPool.totalCapacity.toString(), // TODO: should be cover
      bid.capacity.toString(),
      prevAggPool.totalCapacity.toString(),
    );
  }
}

export function handleLogRiskPoolRemovedFromAggregatedPool(event: LogRiskPoolRemovedFromAggregatedPool): void {
  let aggPool = AggregatedPool.load(event.params.aggregatedPoolId.toString())!;

  let pool = Pool.load(event.params.riskPool.toHexString());

  if (!pool) {
    return;
  }

  pool.markets = filterNotEqual(pool.markets, aggPool.market);

  pool.save();

  aggPool.poolList = filterNotEqual(aggPool.poolList, pool.id);

  aggPool.save();

  let bidId = aggPool.market + "-" + event.params.riskPool.toHexString();
  let bid = Bid.load(bidId);

  if (bid) {
    bid.aggregatedPool = null;
    bid.aggregatedPoolId = BigInt.fromI32(0);

    bid.save();
  }

  addEvent(EventType.PoolMarketCount, event, aggPool.market, pool.id, pool.markets.length.toString());
}

export function handleLogRiskPoolAddedToAggregatedPool(event: LogRiskPoolAddedToAggregatedPool): void {
  let aggPool = AggregatedPool.load(event.params.aggregatedPoolId.toString());

  if (!aggPool) {
    return;
  }

  let id = aggPool.market + "-" + event.params.riskPool.toHexString();
  let bid = Bid.load(id);

  if (!bid) {
    return;
  }

  bid.aggregatedPoolId = event.params.aggregatedPoolId;
  bid.aggregatedPool = aggPool.id;

  bid.save();

  let pool = Pool.load(event.params.riskPool.toHexString());

  if (!pool) {
    return;
  }

  pool.markets = addToList(pool.markets, aggPool.market);

  pool.save();

  aggPool.poolList = addToList(aggPool.poolList, pool.id);

  aggPool.save();

  addEvent(EventType.PoolMarketCount, event, aggPool.market, pool.id, aggPool.poolList.length.toString());
}

export function handleLogRiskPoolOperatorChanged(event: LogRiskPoolOperatorChanged): void {
  let pool = Pool.load(event.params.riskPool.toHexString())!;

  pool.operator = event.params.operator;

  pool.save();
}

export function handleLogRiskPoolOperatorFeeChanged(event: LogRiskPoolOperatorFeeChanged): void {
  let pool = Pool.load(event.params.riskPool.toHexString())!;

  pool.operatorFee = event.params.fee;

  pool.save();
}

export function handleLogRiskPoolOwnerChanged(event: LogRiskPoolOwnerChanged): void {
  let pool = Pool.load(event.params.riskPool.toHexString())!;

  updateFeeRecipientRelation(event.params.owner, event.params.riskPool, pool.owner);

  pool.owner = event.params.owner;

  pool.save();
}

export function handleLogAggregatedPoolCreated(event: LogAggregatedPoolCreated): void {
  let aggPool = createAggregatedPool(event.params.aggregatedPoolId, event.address);
  let prevAggId = aggPool.prevAggregatedPoolId;

  updateAggPoolList(prevAggId.isZero() ? event.params.aggregatedPoolId : prevAggId, RiskPoolsControllerContract.bind(event.address));
}

export function createAggregatedPool(aggregatedPoolId: BigInt, rpcContractAddress: Address): AggregatedPool {
  let rpcContract = RiskPoolsControllerContract.bind(rpcContractAddress);
  let cAggPool = getAggregatedPool(rpcContract, aggregatedPoolId);
  let aggPool = new AggregatedPool(aggregatedPoolId.toString());
  let marketId = rpcContractAddress.toHexString() + "-" + cAggPool.marketId.toString();

  aggPool.market = marketId;
  aggPool.rate = cAggPool.premiumRatePerSec;
  aggPool.totalCapacity = BigInt.fromI32(0);
  aggPool.poolList = [];
  aggPool.premiumAccumulator = cAggPool.premiumAccumulator;
  aggPool.premiumBalance = cAggPool.premiumBalance;
  aggPool.nextAggregatedPoolId = cAggPool.nextAggregatedPoolId;
  aggPool.prevAggregatedPoolId = cAggPool.prevAggregatedPoolId;

  aggPool.save();

  return aggPool;
}

function updateAggPoolList(curAggId: BigInt, rpcContract: RiskPoolsControllerContract): string[] {
  let result: string[] = [];

  while (!curAggId.isZero()) {
    result.push(curAggId.toString());

    let cAggPool = getAggregatedPool(rpcContract, curAggId);
    let aggPool = AggregatedPool.load(curAggId.toString());

    if (!aggPool) {
      aggPool = createAggregatedPool(curAggId, rpcContract._address);
    }

    aggPool.nextAggregatedPoolId = cAggPool.nextAggregatedPoolId;
    aggPool.prevAggregatedPoolId = cAggPool.prevAggregatedPoolId;

    aggPool.save();

    curAggId = cAggPool.nextAggregatedPoolId;
  }

  return result;
}

export function updateMarketChargeState(rpcContractAddress: Address, marketId: string, event: ethereum.Event): void {
  let rpcContract = RiskPoolsControllerContract.bind(rpcContractAddress);
  let market = Market.load(marketId)!;

  market.premiumMulAccumulator = rpcContract.marketsPremiumMulAccumulators(market.marketId);

  const marketMeta = getMarketMeta(rpcContract, market.marketId);

  market.latestAccruedTimestamp = marketMeta.lastChargeTimestamp;
  market.desiredCover = marketMeta.desiredCover;
  market.tailCover = marketMeta.tailCover;

  market.save();

  const rateAndActualCover = getMarketRateAndActualCover(market, rpcContract);

  addEvent(EventType.MarketRatePerSec, event, market.id, market.id, rateAndActualCover.rate.toString());

  addEvent(EventType.MarketActualCover, event, market.id, market.id, rateAndActualCover.actualCover.toString());
}

export function handleLogListCreated(event: LogListCreated): void {
  let allowList = new AllowList(event.params.listId.toString());
  let rpcContract = RiskPoolsControllerContract.bind(event.address);
  let list = getList(rpcContract, event.params.listId);

  allowList.type = list.type;
  allowList.owner = list.editor;
  allowList.descriptionCid = list.descriptionCid;
  allowList.createdBy = event.transaction.from;
  allowList.createdAt = event.block.timestamp;
  allowList.updatedAt = event.block.timestamp;

  allowList.save();

  handleCreateListParameters(event.params.listId, event.transaction.input);
}

function handleCreateListParameters(allowListId: BigInt, input: Bytes): void {
  // function create(uint8,string,address[],uint256[])

  const parameterData = input.slice(4); // cut off 4 bytes function selector
  const accountListOffset = getNumberFromData(64, parameterData);
  const valueListOffset = getNumberFromData(96, parameterData);
  const accounts = getAddressArrayFromData(accountListOffset, parameterData);
  const values = getBigIntArrayFromData(valueListOffset, parameterData);

  updateAllowListAccounts(allowListId, accounts, values);
}

export function handleLogListEdited(event: LogListEdited): void {
  const allowListId = event.params.listId;
  let allowList = new AllowList(allowListId.toString());

  allowList.updatedAt = event.block.timestamp;
  allowList.save();

  // function edit(uint256,address[],uint256[])

  const parameterData = event.transaction.input.slice(4); // cut off 4 bytes function selector
  const accountListOffset = getNumberFromData(32, parameterData);
  const valueListOffset = getNumberFromData(64, parameterData);
  const accounts = getAddressArrayFromData(accountListOffset, parameterData);
  const values = getBigIntArrayFromData(valueListOffset, parameterData);

  updateAllowListAccounts(allowListId, accounts, values);
}

export function handleLogListEditorChanged(event: LogListEditorChanged): void {
  let allowList = new AllowList(event.params.listId.toString());
  let rpcContract = RiskPoolsControllerContract.bind(event.address);
  let list = getList(rpcContract, event.params.listId);

  allowList.owner = list.editor;
  allowList.updatedAt = event.block.timestamp;

  allowList.save();
}

function getBigIntFromData(offset: i32, data: Uint8Array): BigInt {
  return BigInt.fromUnsignedBytes(changetype<Bytes>(data.slice(offset, offset + 32).reverse()));
}

function getNumberFromData(offset: i32, data: Uint8Array): i32 {
  return getBigIntFromData(offset, data).toI32();
}

function getAddressFromData(offset: i32, data: Uint8Array): Address {
  return changetype<Address>(data.slice(offset + 12, offset + 32));
}

function getAddressArrayFromData(startOffset: i32, data: Uint8Array): Address[] {
  const length = getNumberFromData(startOffset, data);
  const result: Address[] = [];

  for (let i = 0; i < length; i++) {
    result.push(getAddressFromData(startOffset + 32 * (i + 1), data));
  }

  return result;
}

function getBigIntArrayFromData(startOffset: i32, data: Uint8Array): BigInt[] {
  const length = getNumberFromData(startOffset, data);
  const result: BigInt[] = [];

  for (let i = 0; i < length; i++) {
    result.push(getBigIntFromData(startOffset + 32 * (i + 1), data));
  }

  return result;
}

export function updateAllowListAccounts(allowListId: BigInt, accounts: Address[], values: BigInt[]): void {
  for (let i = 0; i < accounts.length; i++) {
    let id = allowListId.toString() + "-" + accounts[i].toHexString();
    let listAccount = new AllowListAccount(id);

    listAccount.allowListId = allowListId.toString();
    listAccount.account = accounts[i];
    listAccount.value = values[i];

    listAccount.save();
  }
}

export function handleLogJoinMarket(event: LogJoinMarket): void {
  let bid = getOrCreateBid(event.params.marketId, event.params.riskPool, event.address, event.block.timestamp);

  bid.save();
}

function getOrCreateBid(marketNo: BigInt, riskPoolId: Address, rpcContractAddress: Address, timestamp: BigInt): Bid {
  let marketId = rpcContractAddress.toHexString() + "-" + marketNo.toString();
  let bidId = `${marketId}-${riskPoolId.toHexString()}`;
  let rpcContract = RiskPoolsControllerContract.bind(rpcContractAddress);

  let bid = Bid.load(bidId);

  if (!bid) {
    bid = new Bid(bidId);

    bid.marketId = marketId;
    bid.market = marketId;
    bid.poolId = riskPoolId;
    bid.pool = bid.poolId.toHexString();
    bid.capacity = BigInt.fromI32(0);
    bid.createdAt = timestamp;
  }

  let cBid = rpcContract.bid(marketNo, riskPoolId);

  bid.minPremiumRatePerSec = cBid.minPremiumRatePerSec;
  bid.maxPremiumRatePerSec = cBid.maxPremiumRatePerSec;
  bid.minCoverBuffer = cBid.minCoverBuffer;
  bid.maxCoverBuffer = cBid.maxCoverBuffer;
  bid.aggregatedPoolId = cBid.aggregatedPoolId;
  bid.aggregatedPool = bid.aggregatedPoolId.isZero() ? null : bid.aggregatedPoolId.toString();
  bid.bidOptimization = cBid.bidOptimization;
  bid.maxCapacityLimit = cBid.maxCapacityLimit;
  bid.marketCapacityLimit = cBid.marketCapacityLimit;
  bid.capacityAllowance = cBid.capacityAllowance;
  bid.updatedAt = timestamp;

  return bid;
}

export function handleLogExecutionDelayed(event: LogExecutionDelayed): void {
  let id = event.params.key.toHexString();
  let de = new DelayedExecution(id);

  de.delayedAt = event.params.delayedAt;
  de.data = event.params.msgData;
  de.requestedBy = event.transaction.from;
  de.requestedAt = event.block.timestamp;

  de.save();
}

export function handleLogExecuted(event: LogExecuted): void {
  finishDelayedExecution(event.params.key, event, false);
}

export function handleLogExecutionDeclined(event: LogExecutionDeclined): void {
  finishDelayedExecution(event.params.key, event, true);
}

function finishDelayedExecution(key: Bytes, event: ethereum.Event, isDeclined: boolean): void {
  let id = key.toHexString();
  let de = DelayedExecution.load(id);

  if (!de) {
    return;
  }

  let dehId = updateState(EventType.ExecutionDelay, BigInt.fromI32(1), null).toString();
  let deh = new DelayedExecutionHistory(dehId);

  deh.key = de.id;
  deh.data = de.data;
  deh.requestedBy = de.requestedBy;
  deh.requestedAt = de.requestedAt;
  deh.executedBy = event.transaction.from;
  deh.executedAt = event.block.timestamp;
  deh.isDeclined = isDeclined;

  deh.save();

  store.remove("DelayedExecution", id);
}

export function handleLogLoanRequested(event: LogLoanRequested): void {
  initLoanRequest(event.params.loanRequestId, event.address, event);
}

function initLoanRequest(loanRequestId: BigInt, rpcAddress: Address, event: ethereum.Event): void {
  let loanRequest = LoanRequest.load(loanRequestId.toString());

  if (!loanRequest) {
    loanRequest = new LoanRequest(loanRequestId.toString());

    loanRequest.createdAt = event.block.timestamp;
  }

  let rpcContract = RiskPoolsControllerContract.bind(rpcAddress);
  let cLoanRequest = getLoanRequest(rpcContract, loanRequestId)!;

  loanRequest.policyId = cLoanRequest.policyId;
  loanRequest.amount = cLoanRequest.amount;
  loanRequest.minAmount = cLoanRequest.minAmount;
  loanRequest.maxPremiumRatePerSec = cLoanRequest.maxPremiumRatePerSec;
  loanRequest.approvedAmount = cLoanRequest.approvedAmount;
  loanRequest.filledAmount = cLoanRequest.filledAmount;
  loanRequest.recipient = cLoanRequest.recipient;
  loanRequest.receiveOnApprove = cLoanRequest.receiveOnApprove;
  loanRequest.details = cLoanRequest.details;
  loanRequest.status = cLoanRequest.status;
  loanRequest.updatedAt = event.block.timestamp;

  loanRequest.save();
}

export function handleLogLoanApproved(event: LogLoanApproved): void {
  initLoanRequest(event.params.loanRequestId, event.address, event);
}

export function handleLogLoanRequestClosed(event: LogLoanRequestClosed): void {
  let loanRequest = LoanRequest.load(event.params.loanRequestId.toString())!;

  loanRequest.status = LoanRequestStatusEnum.Closed;
  loanRequest.updatedAt = event.block.timestamp;

  loanRequest.save();
}

export function handleLogLoanRequestModified(event: LogLoanRequestModified): void {
  initLoanRequest(event.params.loanRequestId, event.address, event);
}

function createLoan(loanId: BigInt, rpcAddress: Address, event: ethereum.Event): Loan {
  let loan = new Loan(loanId.toString());
  let rpcContract = RiskPoolsControllerContract.bind(rpcAddress);
  let cLoan = getLoan(rpcContract, loanId)!;
  let policy = getPolicy(rpcContract, cLoan.policyId);

  loan.policyId = cLoan.policyId;
  loan.marketId = policy.marketId;

  loan.loanRequestId = cLoan.loanRequestId;
  loan.loanRequest = cLoan.loanRequestId.toString();
  loan.data = cLoan.data;
  loan.borrowedAmount = cLoan.borrowedAmount;
  loan.lastUpdateTs = cLoan.lastUpdateTs;
  loan.governanceIncentiveFee = cLoan.governanceIncentiveFee;
  loan.productOperatorIncentiveFee = cLoan.productOperatorIncentiveFee;
  loan.marketOperatorIncentiveFee = cLoan.marketOperatorIncentiveFee;
  loan.interestCharged = BigInt.fromI32(0);
  loan.interestRepaid = BigInt.fromI32(0);

  loan.createdAt = event.block.timestamp;

  loan.save();

  return loan;
}

export function handleLogLoanRequestDeclined(event: LogLoanRequestDeclined): void {
  let loanRequest = LoanRequest.load(event.params.loanRequestId.toString())!;

  loanRequest.status = LoanRequestStatusEnum.Declined;

  loanRequest.save();
}

export function handleLogLoanDataUpdated(event: LogLoanDataUpdated): void {
  let loan = Loan.load(event.params.loanData.toString())!;

  loan.data = event.params.data.toString();

  loan.save();
}

export function handleLogLoanPrincipalRepaid(event: LogLoanPrincipalRepaid): void {
  let id = event.params.loanId.toString() + "-" + event.params.riskPool.toHexString();
  let chunk = LoanChunk.load(id)!;
  let rpcContract = RiskPoolsControllerContract.bind(event.address);
  let cChunk = getLoanChunk(rpcContract, event.params.loanId, event.params.chunkIndex)!;

  chunk.accruedInterest = cChunk.accruedInterest;
  chunk.lastUpdateTs = cChunk.lastUpdateTs;
  chunk.repaidAmount = chunk.repaidAmount.plus(event.params.repaidCapitalTokenAmount);

  chunk.save();

  addPaymentRecord(event.params.loanId, event.params.riskPool, event.params.repaidCapitalTokenAmount, null, event);
}

function addPaymentRecord(loanId: BigInt, poolId: Address, principle: BigInt | null, interest: BigInt | null, event: ethereum.Event): void {
  let paymentId = updateState(EventType.PaymentCount, BigInt.fromI32(1), "");

  let payment = new LoanPayment(paymentId.toString());

  payment.loanId = loanId;
  payment.poolId = poolId;
  payment.paidPrinciple = principle ? principle : BigInt.fromI32(0);
  payment.paidInterest = interest ? interest : BigInt.fromI32(0);
  payment.payer = event.transaction.from;
  payment.createdAt = event.block.timestamp;

  payment.save();
}

export function handleLogLoanInterestPaid(event: LogLoanInterestPaid): void {
  let id = event.params.loanId.toString() + "-" + event.params.riskPool.toHexString();
  let chunk = LoanChunk.load(id)!;

  let rpcContract = RiskPoolsControllerContract.bind(event.address);
  let cChunk = getLoanChunk(rpcContract, event.params.loanId, event.params.chunkIndex)!;

  chunk.accruedInterest = cChunk.accruedInterest;
  chunk.lastUpdateTs = cChunk.lastUpdateTs;

  chunk.save();

  let loan = Loan.load(event.params.loanId.toString())!;

  loan.interestRepaid = loan.interestRepaid.plus(event.params.premiumTokenAmount);

  loan.save();

  addPaymentRecord(event.params.loanId, event.params.riskPool, null, event.params.premiumTokenAmount, event);
}

export function handleLogLoanTransferred(event: LogLoanTransferred): void {
  let rpcContract = RiskPoolsControllerContract.bind(event.address);
  let ptiAddress = rpcContract.policyTokenIssuer();
  let loan = Loan.load(event.params.loanId.toString());

  if (!loan) {
    loan = createLoan(event.params.loanId, event.address, event);
  }

  initLoanRequest(loan.loanRequestId, event.address, event);

  let policy = Policy.load(ptiAddress.toHexString() + "-" + loan.policyId.toString())!;

  policy.coverage = policy.coverage.minus(event.params.capitalTokenAmount);

  policy.save();

  let market = Market.load(policy.market.toString())!;

  market.desiredCover = market.desiredCover.minus(event.params.capitalTokenAmount);

  market.save();

  let id = event.params.loanId.toString() + "-" + event.params.riskPool.toHexString();
  let chunk = new LoanChunk(id);

  chunk.loanId = event.params.loanId;
  chunk.poolId = event.params.riskPool;
  chunk.rate = event.params.premiumRatePerSec;
  chunk.borrowedAmount = event.params.capitalTokenAmount;
  chunk.borrowedAmountInPoolAssetToken = event.params.assetTokenAmount;
  chunk.repaidAmount = BigInt.fromI32(0);
  chunk.lastUpdateTs = event.block.timestamp;
  chunk.accruedInterest = BigInt.fromI32(0);

  chunk.save();
}

export function handleLogLoanInterestCharged(event: LogLoanInterestCharged): void {
  let loan = Loan.load(event.params.loanId.toString())!;

  loan.interestCharged = loan.interestCharged.plus(event.params.amount);

  loan.save();
}

export function handleLogPolicyCoverDelegationOperatorUpdated(event: LogPolicyCoverDelegationOperatorUpdated): void {
  let rpcContract = RiskPoolsControllerContract.bind(event.address);
  let ptiAddress = rpcContract.policyTokenIssuer();
  let policy = Policy.load(ptiAddress.toHexString() + "-" + event.params.policyId.toString())!;

  policy.delegationOperator = event.params.operator;

  policy.save();
}

export function handleLogPolicyCoverDelegationUpdated(event: LogPolicyCoverDelegationUpdated): void {
  let rpcContract = RiskPoolsControllerContract.bind(event.address);
  let ptiAddress = rpcContract.policyTokenIssuer();
  let policy = Policy.load(ptiAddress.toHexString() + "-" + event.params.policyId.toString())!;
  let cCoverDelegation = getPolicyCoverDelegation(rpcContract, event.params.policyId);

  policy.delegationIntegrationNumber = cCoverDelegation.integrationNumber;
  policy.delegationData = cCoverDelegation.data;
  policy.delegationRootHash = cCoverDelegation.rootHash.toHexString();

  policy.save();
}
