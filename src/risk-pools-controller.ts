import {
  LogGovernance,
  LogLiquidation,
  LogMarketStatusChanged,
  LogNewMarketStatus,
  LogNewPool,
  LogNewProduct,
  LogNewProductStatus,
  LogNewSystemStatus,
  LogNextLevelAdded,
  LogNextLevelRemoved,
  LogPolicyCoverChanged,
  LogPermissionTokenIssued,
  LogPolicyDeposit,
  LogPolicyWithdraw,
  LogRiskPoolAddedToLevel,
  LogRiskPoolRemovedFromLevel,
  LogWithdrawFee,
  LogFeeAccrued,
  RiskPoolsController,
  LogSwap,
  LogPayout,
  LogNewPayoutRequest,
  LogNewForwardedPayoutRequest,
  LogForwardedPayoutRequestProcessed,
  LogForwardedPayoutRequestDeclined,
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
  FrontendOperator,
  AccruedFee,
  PremiumRateModel,
  Swap,
  Payout,
  PayoutRequest,
  IncomingPayoutRequest,
} from "../generated/schema";
import {
  EventType,
  getState,
  updateAndLogState,
  updateState,
  updateSystemStatus,
} from "./event";
import {
  Address,
  BigDecimal,
  BigInt,
  Bytes,
  ethereum,
  log,
} from "@graphprotocol/graph-ts";
import {
  addPoolToMarket,
  createPool,
  ETH_ADDRESS,
  filterNotEqual,
  removePoolsAtLevel,
} from "./product";
import { Product as ProductContract } from "../generated/RiskPoolsController/Product";
import { PremiumRateModelFixed } from "../generated/RiskPoolsController/PremiumRateModelFixed";
import { PremiumRateModelDynamic } from "../generated/RiskPoolsController/PremiumRateModelDynamic";
import { PolicyTokenIssuer as PolicyTokenIssuerContract } from "../generated/RiskPoolsController/PolicyTokenIssuer";
import { getSystemConfig } from "./system";
import { addOraclePair } from "./rate-oracle";
import { GovernanceLogType } from "./governance-type.enum";
import {
  CPolicy,
  getForwardedPayoutRequest,
  getMarketMeta,
  getPayoutRequest,
  getPolicy,
} from "./contract-mapper";

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
  product.policyTokenIssuerAddress =
    riskPoolsControllerContract.policyTokenIssuer();
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
  product.defaultCoverAdjusterOracle =
    productContract.defaultCoverAdjusterOracle();
  product.productType = productContract.productType();
  product.policyType = productContract.policyType();
  product.payoutApprover = productContract.payoutApprover();
  product.payoutRequester = productContract.payoutRequester();
  product.productIncentiveFee = productInfo.value2;
  product.maxMarketIncentiveFee = productInfo.value3;

  product.defaultPremiumRateModels = changetype<Bytes[]>(productContract.getDefaultPremiumRateModels());
  product.defaultRatesOracle = productContract.defaultRatesOracle();
  product.withdrawalDelay = productContract.withdrawalDelay();
  product.withdrawRequestExpiration =
    productContract.withdrawRequestExpiration();
  product.waitingPeriod = productContract.waitingPeriod();
  product.marketCreatorsAllowlistId =
    productContract.marketCreatorsAllowlistId();
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
  PayoutRequesterTemplate.create(product.claimProcessor as Address);

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

  market.exposure = market.exposure.plus(policy.coverage).minus(oldCoverage);

  market.save();

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
    Address.fromHexString(market.product) as Address
  );
  let rpcContract = RiskPoolsControllerContract.bind(
    productContract.riskPoolsController()
  );
  let ptiAddress = rpcContract.policyTokenIssuer();
  let ptiContract = PolicyTokenIssuerContract.bind(ptiAddress);

  let policyCount = ptiContract.lastPolicyId().toI32();

  market.premiumMulAccumulator = rpcContract.marketsPremiumMulAccumulators(
    market.marketId
  );
  market.latestAccruedTimestamp = getMarketMeta(
    rpcContract,
    market.marketId
  ).accrualBlockNumberPrior;

  market.save();

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

export function handleLogRiskPoolAddedToLevel(
  event: LogRiskPoolAddedToLevel
): void {
  let rpcContract = RiskPoolsControllerContract.bind(event.address);
  let marketId = event.params.marketId;
  let poolId = event.params.riskPool;
  let levelId = event.params.levelId;

  let currentLevel = rpcContract.riskTowerBase(marketId);
  let levelNo = 1;

  while (!currentLevel.isZero() && currentLevel != levelId) {
    levelNo++;
    currentLevel = rpcContract.nextLevelId(marketId, currentLevel);
  }

  addPoolToMarket(
    poolId,
    event.address.toHexString() + "-" + marketId.toString(),
    event,
    levelId,
    levelNo,
    event.address
  );
}

export function handleLogRiskPoolRemovedFromLevel(
  event: LogRiskPoolRemovedFromLevel
): void {
  event.params.levelId;
  event.params.marketId;
  event.params.riskPool;

  removePoolsAtLevel(
    event.params.levelId,
    event.address.toHexString() + "-" + event.params.marketId.toString(),
    event,
    [event.params.riskPool.toHexString()]
  );
}

export function handleLogNextLevelRemoved(event: LogNextLevelRemoved): void {
  let marketId = event.params.marketId;

  removePoolsAtLevel(
    event.params.levelIdToRemove,
    event.address.toHexString() + "-" + marketId.toString(),
    event
  );
}

export function handleLogNextLevelAdded(event: LogNextLevelAdded): void {
  let rpcContract = RiskPoolsControllerContract.bind(event.address);
  let marketId = event.params.marketId;
  let levelId = event.params.levelIdToAdd;

  let currentLevel = rpcContract.riskTowerBase(marketId);
  let levelNo = 1;

  while (!currentLevel.isZero() && currentLevel != levelId) {
    levelNo++;
    currentLevel = rpcContract.nextLevelId(marketId, currentLevel);
  }

  let pools = rpcContract.riskPoolsAtLevel(marketId, currentLevel);

  for (let i = 0; i < pools.length; i++) {
    addPoolToMarket(
      pools[i],
      event.address.toHexString() + "-" + marketId.toString(),
      event,
      levelId,
      levelNo,
      event.address
    );
  }
}

function handleUpdateNewOperator(event: LogGovernance): void {
  let config = getSystemConfig(event.address.toHexString());

  config.operator = event.params.param1;
  config.save();
}

function handleUpdateTreasury(event: LogGovernance): void {
  let config = getSystemConfig(event.address.toHexString());

  config.treasury = event.params.param1;
  config.save();
}

function handleUpdateDefaultPayoutRequester(event: LogGovernance): void {
  let config = getSystemConfig(event.address.toHexString());

  config.defaultPayoutRequester = event.params.param1;
  config.save();
}

function handleUpdateDefaultPayoutApprover(event: LogGovernance): void {
  let config = getSystemConfig(event.address.toHexString());

  config.defaultPayoutApprover = event.params.param1;
  config.save();
}

function handleUpdateProductCreatorsAllowlistId(event: LogGovernance): void {
  let config = getSystemConfig(event.address.toHexString());

  config.productCreatorsAllowlistId = event.params.param3;
  config.save();
}

function handleUpdateGovernanceIncentiveFee(event: LogGovernance): void {
  let config = getSystemConfig(event.address.toHexString());

  config.governanceFee = event.params.param3;
  config.save();
}

function handleUpdateMaxProductOperatorIncentiveFee(
  event: LogGovernance
): void {
  let config = getSystemConfig(event.address.toHexString());

  config.maxProductOperatorIncentiveFee = event.params.param3;
  config.save();
}

function handleUpdateMaxMarketOperatorIncentiveFee(event: LogGovernance): void {
  let product = Product.load(event.params.param1.toHexString());

  if (product != null) {
    product.maxMarketIncentiveFee = event.params.param3;
    product.save();

    return;
  }

  let config = getSystemConfig(event.address.toHexString());

  config.maxMarketOperatorIncentiveFee = event.params.param3;
  config.save();
}

function handleUpdateExchangeRateOracle(event: LogGovernance): void {
  let config = getSystemConfig(event.address.toHexString());

  if (event.params.param5) {
    let l = config.rateOracleList;

    if (l.indexOf(event.params.param1.toHexString()) < 0) {
      l.push(event.params.param1.toHexString());
    }

    config.rateOracleList = l;
  } else {
    config.rateOracleList = filterNotEqual(
      config.rateOracleList,
      event.params.param1.toHexString()
    );
  }

  config.save();
}

function handleUpdatePremiumRateModel(event: LogGovernance): void {
  let config = getSystemConfig(event.address.toHexString());

  if (event.params.param5) {
    let l = config.premiumRateModelList;

    if (l.indexOf(event.params.param1.toHexString()) < 0) {
      l.push(event.params.param1.toHexString());
    }

    config.premiumRateModelList = l;

    guessRateModelType(event.params.param1);
  } else {
    config.premiumRateModelList = filterNotEqual(
      config.premiumRateModelList,
      event.params.param1.toHexString()
    );
  }

  config.save();
}

function handleUpdateCoverAdjusterOracle(event: LogGovernance): void {
  let config = getSystemConfig(event.address.toHexString());

  if (event.params.param5) {
    let l = config.coverAdjusterOracleList;

    if (l.indexOf(event.params.param1.toHexString()) < 0) {
      l.push(event.params.param1.toHexString());
    }

    config.coverAdjusterOracleList = l;
  } else {
    config.coverAdjusterOracleList = filterNotEqual(
      config.coverAdjusterOracleList,
      event.params.param1.toHexString()
    );
  }

  config.save();
}

function handleSyncOracle(event: LogGovernance): void {
  let config = getSystemConfig(event.address.toHexString());

  if (event.params.param5) {
    let l = config.syncOracleList;

    if (l.indexOf(event.params.param1.toHexString()) < 0) {
      l.push(event.params.param1.toHexString());
    }

    config.syncOracleList = l;
  } else {
    config.syncOracleList = filterNotEqual(
      config.syncOracleList,
      event.params.param1.toHexString()
    );
  }

  config.save();
}

function handleUpdateMarketCoverAdjusterOracle(event: LogGovernance): void {
  let id = event.address.toHexString() + "-" + event.params.param3.toString();
  let market = Market.load(id);

  if (!market) {
    return;
  }

  market.coverAdjusterOracle = event.params.param1;

  market.save();
}

function handleUpdateExternalProduct(event: LogGovernance): void {
  let config = getSystemConfig(event.address.toHexString());

  if (true) {
    // event.params.param5) { Until the issue in contract fixed we can add ext. products only.
    let l = config.externalProductList;

    if (l.indexOf(event.params.param1.toHexString()) < 0) {
      l.push(event.params.param1.toHexString());
    }

    config.externalProductList = l;
  } else {
    config.externalProductList = filterNotEqual(
      config.externalProductList,
      event.params.param1.toHexString()
    );
  }

  config.save();
}

function handleUpdateRiskPoolMarketCapacityAllowance(
  event: LogGovernance
): void {
  let pmrId =
    event.params.param1.toHexString() +
    "-" +
    event.address.toHexString() +
    "-" +
    event.params.param3.toString();
  let marketRelation = PoolMarketRelation.load(pmrId);

  if (marketRelation) {
    marketRelation.allowance = event.params.param4;

    marketRelation.save();
  }
}

function handleUpdateMarketExchangeRateOracle(event: LogGovernance): void {
  let id = event.address.toHexString() + "-" + event.params.param3.toString();
  let market = Market.load(id);

  if (!market) {
    return;
  }

  market.rateOracle = event.params.param1;

  market.save();

  if (market.rateOracle) {
    addOraclePair(
      market.rateOracle!.toHexString(),
      market.capitalToken,
      market.premiumToken
    );
  }
  addOraclePair(
    market.rateOracle!.toHexString(),
    market.premiumToken,
    Address.fromHexString(ETH_ADDRESS) as Bytes
  );
}

function handleUpdateRiskPoolMcr(event: LogGovernance): void {
  let pool = Pool.load(event.params.param1.toHexString());

  if (!pool) {
    return;
  }

  pool.mcr = event.params.param3;

  pool.save();
}

function handleUpdateRiskPoolWithdrawDelay(event: LogGovernance): void {
  let pool = Pool.load(event.params.param1.toHexString());

  if (!pool) {
    return;
  }

  pool.withdrawDelay = event.params.param3;

  pool.save();
}

function handleUpdateRiskPoolWithdrawRequestExpiration(
  event: LogGovernance
): void {
  let pool = Pool.load(event.params.param1.toHexString());

  if (!pool) {
    return;
  }

  pool.withdrawRequestExpiration = event.params.param3;

  pool.save();
}

function handleUpdateRiskPoolPremiumRateModel(event: LogGovernance): void {
  let pool = Pool.load(event.params.param1.toHexString());

  if (!pool) {
    return;
  }

  pool.premiumRateModel = event.params.param2;
  pool.save();
}

function handleUpdateMarketPolicyBuyerAllowlistId(event: LogGovernance): void {
  let id = event.address.toHexString() + "-" + event.params.param3.toString();
  let market = Market.load(id);

  if (!market) {
    return;
  }

  market.policyBuyerAllowListId = event.params.param4;

  market.save();
}

function handleUpdateRiskPoolLpAllowlistId(event: LogGovernance): void {
  let pool = Pool.load(event.params.param1.toHexString());

  if (!pool) {
    return;
  }

  pool.lpAllowListId = event.params.param3;

  pool.save();
}

function handleUpdateProductWording(event: LogGovernance): void {
  let address = event.params.param1;
  let product = Product.load(address.toHexString());
  let rpcContract = RiskPoolsControllerContract.bind(event.address);

  if (!product) {
    return;
  }

  product.wording = rpcContract.products(address).value0;

  product.save();
}

function handleUpdateProductOperator(event: LogGovernance): void {
  let product = Product.load(event.params.param1.toHexString());

  if (!product) {
    return;
  }

  product.operator = event.params.param2;

  product.save();
}

function handleUpdateMarketOperator(event: LogGovernance): void {
  let id = event.address.toHexString() + "-" + event.params.param3.toString();
  let market = Market.load(id);

  if (!market) {
    return;
  }

  market.author = event.params.param1;

  market.save();
}

function handleUpdateProductOperatorIncentiveFee(event: LogGovernance): void {
  let product = Product.load(event.params.param1.toHexString());

  if (!product) {
    return;
  }

  product.productIncentiveFee = event.params.param3;

  product.save();
}

function handleUpdateProductMaxMarketIncentiveFee(event: LogGovernance): void {
  let product = Product.load(event.params.param1.toHexString());

  if (!product) {
    return;
  }

  product.maxMarketIncentiveFee = event.params.param3;
  product.save();
}

function handleUpdateMarketOperatorIncentiveFee(event: LogGovernance): void {
  let id = event.address.toHexString() + "-" + event.params.param3.toString();
  let market = Market.load(id);

  if (!market) {
    return;
  }

  market.marketOperatorIncentiveFee = event.params.param4;

  market.save();
}

function handleUpdateLiquidationGasUsage(event: LogGovernance): void {
  let config = getSystemConfig(event.address.toHexString());

  config.liquidationGasUsage = event.params.param3;
  config.save();
}

function handleUpdateLiquidationIncentive(event: LogGovernance): void {
  let config = getSystemConfig(event.address.toHexString());

  config.liquidationIncentive = event.params.param3;
  config.save();
}

function handleUpdateSolvencyMultiplier(event: LogGovernance): void {
  let config = getSystemConfig(event.address.toHexString());

  config.solvencyMultiplier = event.params.param3;
  config.save();
}

function handleUpdateMinPolicyDepositMultiplier(event: LogGovernance): void {
  let config = getSystemConfig(event.address.toHexString());

  config.minPolicyDepositMultiplier = event.params.param3;
  config.save();
}

function handleNewFrontendOperator(event: LogGovernance): void {
  let fo = new FrontendOperator(event.params.param1.toHexString());
  let rpcContract = RiskPoolsControllerContract.bind(event.address);
  let foInfo = rpcContract.frontendOperators(event.params.param1);

  fo.feeRecipient = foInfo.value0;
  fo.frontendOperatorFee = foInfo.value1;
  fo.referralFee = foInfo.value2;
  fo.policyBuyerReferralBonus = foInfo.value3;
  fo.meta = foInfo.value4;
  fo.isActive = foInfo.value5;

  fo.save();
}

function handleFrontendOperatorDisabled(event: LogGovernance): void {
  let fo = FrontendOperator.load(event.params.param1.toHexString());

  if (fo != null) {
    fo.isActive = false;

    fo.save();
  }
}

function handleFrontendOperatorEnabled(event: LogGovernance): void {
  let fo = FrontendOperator.load(event.params.param1.toHexString());

  if (fo != null) {
    fo.isActive = true;

    fo.save();
  }
}

function handleFrontendOperatorFee(event: LogGovernance): void {
  let fo = FrontendOperator.load(event.params.param1.toHexString());

  if (fo != null) {
    fo.frontendOperatorFee = event.params.param3;

    fo.save();
  }
}

function handleReferralFee(event: LogGovernance): void {
  let fo = FrontendOperator.load(event.params.param1.toHexString());

  if (fo != null) {
    fo.referralFee = event.params.param3;

    fo.save();
  }
}

function handlePolicyBuyerReferralBonus(event: LogGovernance): void {
  let fo = FrontendOperator.load(event.params.param1.toHexString());

  if (fo != null) {
    let rpcContract = RiskPoolsControllerContract.bind(event.address);

    fo.policyBuyerReferralBonus = event.params.param3;
    fo.meta = rpcContract.frontendOperators(event.params.param1).value4;

    fo.save();
  }
}

function handleUpdateRiskPoolCapitalRequirement(event: LogGovernance): void {
  let pool = Pool.load(event.params.param1.toHexString());

  if (!pool) {
    return;
  }

  pool.capitalRequirement = event.params.param3;

  pool.save();
}

function handleFrontendOperatorPenalty(event: LogGovernance): void {
  let id =
    event.params.param1.toHexString() + "-" + event.params.param2.toHexString();
  let af = AccruedFee.load(id);

  if (af != null) {
    af.balance = event.params.param3;

    af.save();
  }
}

let map = new Map<GovernanceLogType, (event: LogGovernance) => void>();

map.set(GovernanceLogType.NewOperator, handleUpdateNewOperator);
map.set(GovernanceLogType.Treasury, handleUpdateTreasury);
map.set(
  GovernanceLogType.DefaultPayoutRequester,
  handleUpdateDefaultPayoutRequester
);
map.set(
  GovernanceLogType.DefaultPayoutApprover,
  handleUpdateDefaultPayoutApprover
);
map.set(
  GovernanceLogType.ProductCreatorsAllowlistId,
  handleUpdateProductCreatorsAllowlistId
);
map.set(
  GovernanceLogType.GovernanceIncentiveFee,
  handleUpdateGovernanceIncentiveFee
);
map.set(
  GovernanceLogType.MaxProductOperatorIncentiveFee,
  handleUpdateMaxProductOperatorIncentiveFee
);
map.set(
  GovernanceLogType.MaxMarketOperatorIncentiveFee,
  handleUpdateMaxMarketOperatorIncentiveFee
);
map.set(GovernanceLogType.ExchangeRateOracle, handleUpdateExchangeRateOracle);
map.set(GovernanceLogType.PremiumRateModel, handleUpdatePremiumRateModel);
map.set(GovernanceLogType.CoverAdjusterOracle, handleUpdateCoverAdjusterOracle);
map.set(GovernanceLogType.SyncOracle, handleSyncOracle);
map.set(
  GovernanceLogType.MarketCoverAdjusterOracle,
  handleUpdateMarketCoverAdjusterOracle
);
map.set(GovernanceLogType.ExternalProduct, handleUpdateExternalProduct);
map.set(
  GovernanceLogType.RiskPoolMarketCapacityAllowance,
  handleUpdateRiskPoolMarketCapacityAllowance
);
map.set(
  GovernanceLogType.MarketExchangeRateOracle,
  handleUpdateMarketExchangeRateOracle
);
map.set(GovernanceLogType.RiskPoolMcr, handleUpdateRiskPoolMcr);
map.set(
  GovernanceLogType.RiskPoolWithdrawDelay,
  handleUpdateRiskPoolWithdrawDelay
);
map.set(
  GovernanceLogType.RiskPoolWithdrawRequestExpiration,
  handleUpdateRiskPoolWithdrawRequestExpiration
);
map.set(
  GovernanceLogType.RiskPoolPremiumRateModel,
  handleUpdateRiskPoolPremiumRateModel
);
map.set(
  GovernanceLogType.MarketPolicyBuyerAllowlistId,
  handleUpdateMarketPolicyBuyerAllowlistId
);
map.set(
  GovernanceLogType.RiskPoolLpAllowlistId,
  handleUpdateRiskPoolLpAllowlistId
);
map.set(GovernanceLogType.ProductWording, handleUpdateProductWording);
map.set(GovernanceLogType.ProductOperator, handleUpdateProductOperator);
map.set(GovernanceLogType.MarketOperator, handleUpdateMarketOperator);
map.set(
  GovernanceLogType.ProductOperatorIncentiveFee,
  handleUpdateProductOperatorIncentiveFee
);
map.set(
  GovernanceLogType.ProductMaxMarketIncentiveFee,
  handleUpdateProductMaxMarketIncentiveFee
);
map.set(
  GovernanceLogType.MarketOperatorIncentiveFee,
  handleUpdateMarketOperatorIncentiveFee
);
map.set(GovernanceLogType.LiquidationGasUsage, handleUpdateLiquidationGasUsage);

map.set(
  GovernanceLogType.LiquidationIncentive,
  handleUpdateLiquidationIncentive
);
map.set(GovernanceLogType.SolvencyMultiplier, handleUpdateSolvencyMultiplier);
map.set(
  GovernanceLogType.MinPolicyDepositMultiplier,
  handleUpdateMinPolicyDepositMultiplier
);
map.set(GovernanceLogType.NewFrontendOperator, handleNewFrontendOperator);
map.set(
  GovernanceLogType.FrontendOperatorDisabled,
  handleFrontendOperatorDisabled
);
map.set(
  GovernanceLogType.FrontendOperatorEnabled,
  handleFrontendOperatorEnabled
);
map.set(GovernanceLogType.FrontendOperatorFee, handleFrontendOperatorFee);
map.set(GovernanceLogType.ReferralFee, handleReferralFee);
map.set(
  GovernanceLogType.PolicyBuyerReferralBonus,
  handlePolicyBuyerReferralBonus
);
map.set(
  GovernanceLogType.RiskPoolCapitalRequirement,
  handleUpdateRiskPoolCapitalRequirement
);
map.set(
  GovernanceLogType.FrontendOperatorPenalty,
  handleFrontendOperatorPenalty
);
map.set(
  GovernanceLogType.PolicyBuyerReferralBonus,
  handlePolicyBuyerReferralBonus
);
map.set(GovernanceLogType.BridgeConnector, handleBridgeConnector);
map.set(
  GovernanceLogType.ConnectedCapacityDetailsConfidenceInterval,
  handleConnectedCapacityDetailsConfidenceInterval
);
map.set(GovernanceLogType.SwapCycle, handleSwapCycle);
map.set(GovernanceLogType.SettlementDiscount, handleSettlementDiscount);

export function handleConnectedCapacityDetailsConfidenceInterval(
  event: LogGovernance
): void {
  let config = getSystemConfig(event.address.toHexString());

  config.extPoolDetailsConfidenceInterval = event.params.param3;

  config.save();
}

export function handleSettlementDiscount(
  event: LogGovernance
): void {
  let id = event.address.toHexString() + "-" + event.params.param3.toString();
  let market = Market.load(id);

  if (!market) {
    return;
  }

  market.settlementDiscount = event.params.param4;

  market.save();
}

export function handleSwapCycle(
  event: LogGovernance
): void {
  let config = getSystemConfig(event.address.toHexString());
  let rpcContract = RiskPoolsControllerContract.bind(event.address);

  config.swapCycleDuration = rpcContract.swapCycleDuration();
  config.swapDuration = rpcContract.swapDuration();
  config.idleDuration = rpcContract.idleDuration();

  config.save();
}

export function handleBridgeConnector(event: LogGovernance): void {
  let config = getSystemConfig(event.address.toHexString());

  config.bridgeConnector = event.params.param1;

  config.save();
}

export function handleLogGovernance(event: LogGovernance): void {
  if (map.has(event.params.logType)) {
    map.get(event.params.logType)(event);

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

export function handleLogPolicyWithdraw(event: LogPolicyWithdraw): void {
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
    .minus(event.params.withdrawnPremiumFeeDeposit)
    .minus(event.params.withdrawnFrontendOperatorFeeDeposit)
    .minus(event.params.withdrawnReferralFeeDeposit);

  policy.save();

  updatePolicy(id, event.address, event);
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
    market.premiumToken as Address
  );
  let pInfo = rpcContract.policyDeposits(
    policy.policyId,
    market.premiumToken as Address
  );
  let balance = !result.reverted ? result.value : BigInt.fromI32(0);

  policy.totalCharged = policy.originalBalance.minus(balance);
  policy.balance = balance;

  policy.premiumDeposit = pInfo.value0;
  policy.foFeeDeposit = pInfo.value1;
  policy.referralFeeDeposit = pInfo.value2;
  policy.initialMarketPremiumMulAccumulator = pInfo.value3;

  policy.updatedAt = event.block.timestamp;

  updatePolicyCoverage(policy, getPolicy(rpcContract, policy.policyId), event);

  policy.save();
}

export function handleLogFeeAccrued(event: LogFeeAccrued): void {
  increaseFeeRecipientBalance(
    event.params.frontendOperatorFeeRecipient,
    event.params.premiumToken,
    event.params.frontendOperatorFee
  );
  increaseFeeRecipientBalance(
    event.params.referralFeeRecipient,
    event.params.premiumToken,
    event.params.referralFee
  );
}

function increaseFeeRecipientBalance(
  recipient: Address,
  token: Address,
  amount: BigInt
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

enum PremiumModelType {
  Unknown = 0,
  Fixed = 1,
  Dynamic = 2,
}

let SECONDS_IN_A_YEAR = BigInt.fromI32(60 * 60 * 24 * 365);
let WEI_BIGINT = BigInt.fromI32(1000000000).times(BigInt.fromI32(1000000000));
let WEI_DECIMALS = new BigDecimal(WEI_BIGINT);

function guessRateModelType(modelAddress: Address): void {
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
    rate0Result.value.times(SECONDS_IN_A_YEAR).times(hnd).toString()
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
    rate1Result.value.times(SECONDS_IN_A_YEAR).times(hnd).toString()
  ).div(WEI_DECIMALS);
  model.rate2 = BigDecimal.fromString(
    rate2Result.value.times(SECONDS_IN_A_YEAR).times(hnd).toString()
  ).div(WEI_DECIMALS);
  model.type = PremiumModelType.Dynamic;

  model.save();
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
