import { LogGovernance } from "../generated/RiskPoolsController/RiskPoolsController";
import { AccruedFee, FrontendOperator, Market, Pool, Product } from "../generated/schema";
import { GovernanceLogType } from "./governance-type.enum";
import { CoverAdjuster as CoverAdjusterTemplate } from "../generated/templates";
import { RiskPoolsController as RiskPoolsControllerContract } from "../generated/RiskPoolsController/RiskPoolsController";
import { getSystemConfig } from "./system";
import { addOraclePair } from "./rate-oracle";
import { Address } from "@graphprotocol/graph-ts";
import { addUniqueToList, ETH_ADDRESS, filterNotEqual } from "./utils";
import { addEvent, EventType } from "./event";
import { getMarket, getProduct, getProductMeta } from "./contract-mapper";

export const GovernanceOperationMap = new Map<GovernanceLogType, (event: LogGovernance) => void>();

//#region  Registrations

GovernanceOperationMap.set(GovernanceLogType.NewOperator, handleUpdateNewOperator);
GovernanceOperationMap.set(GovernanceLogType.ExecutionDelay, handleUpdateExecutionDelay);
GovernanceOperationMap.set(GovernanceLogType.NewAllowanceManager, handleUpdateNewAllowanceManager);
GovernanceOperationMap.set(GovernanceLogType.Treasury, handleUpdateTreasury);
GovernanceOperationMap.set(GovernanceLogType.DefaultPayoutRequester, handleUpdateDefaultPayoutRequester);
GovernanceOperationMap.set(GovernanceLogType.DefaultPayoutApprover, handleUpdateDefaultPayoutApprover);
GovernanceOperationMap.set(GovernanceLogType.ProductCreatorsAllowlistId, handleUpdateProductCreatorsAllowlistId);
GovernanceOperationMap.set(GovernanceLogType.GovernanceIncentiveFee, handleUpdateGovernanceIncentiveFee);
GovernanceOperationMap.set(GovernanceLogType.MaxProductOperatorIncentiveFee, handleUpdateMaxProductOperatorIncentiveFee);
GovernanceOperationMap.set(GovernanceLogType.MaxMarketOperatorIncentiveFee, handleUpdateMaxMarketOperatorIncentiveFee);
GovernanceOperationMap.set(GovernanceLogType.ExchangeRateOracle, handleUpdateExchangeRateOracle);
GovernanceOperationMap.set(GovernanceLogType.CoverAdjusterOracle, handleUpdateCoverAdjusterOracle);
GovernanceOperationMap.set(GovernanceLogType.SyncOracle, handleSyncOracle);
GovernanceOperationMap.set(GovernanceLogType.MarketDetails, handleMarketDetails);
GovernanceOperationMap.set(GovernanceLogType.MarketCoverAdjusterOracle, handleUpdateMarketCoverAdjusterOracle);
GovernanceOperationMap.set(GovernanceLogType.ExternalProduct, handleUpdateExternalProduct);
GovernanceOperationMap.set(GovernanceLogType.MarketExchangeRateOracle, handleUpdateMarketExchangeRateOracle);
GovernanceOperationMap.set(GovernanceLogType.RiskPoolWithdrawDelay, handleUpdateRiskPoolWithdrawDelay);
GovernanceOperationMap.set(GovernanceLogType.RiskPoolWithdrawRequestExpiration, handleUpdateRiskPoolWithdrawRequestExpiration);
GovernanceOperationMap.set(GovernanceLogType.MarketPolicyBuyerAllowlistId, handleUpdateMarketPolicyBuyerAllowListId);
GovernanceOperationMap.set(GovernanceLogType.MarketPolicyBuyerAllowancelistId, handleUpdateMarketPolicyBuyerAllowanceListId);
GovernanceOperationMap.set(GovernanceLogType.RiskPoolLpAllowlistId, handleUpdateRiskPoolLpAllowlistId);
GovernanceOperationMap.set(GovernanceLogType.ProductWording, handleUpdateProductWording);
GovernanceOperationMap.set(GovernanceLogType.ProductOperator, handleUpdateProductOperator);
GovernanceOperationMap.set(GovernanceLogType.MarketOperator, handleUpdateMarketOperator);
GovernanceOperationMap.set(GovernanceLogType.ProductOperatorIncentiveFee, handleUpdateProductOperatorIncentiveFee);
GovernanceOperationMap.set(GovernanceLogType.ProductMaxMarketIncentiveFee, handleUpdateProductMaxMarketIncentiveFee);
GovernanceOperationMap.set(GovernanceLogType.MarketOperatorIncentiveFee, handleUpdateMarketOperatorIncentiveFee);
GovernanceOperationMap.set(GovernanceLogType.LiquidationGasUsage, handleUpdateLiquidationGasUsage);

GovernanceOperationMap.set(GovernanceLogType.LiquidationIncentive, handleUpdateLiquidationIncentive);
GovernanceOperationMap.set(GovernanceLogType.SolvencyMultiplier, handleUpdateSolvencyMultiplier);
GovernanceOperationMap.set(GovernanceLogType.MinPolicyDepositMultiplier, handleUpdateMinPolicyDepositMultiplier);
GovernanceOperationMap.set(GovernanceLogType.MaxRiskPoolManagerFee, handleUpdateMaxRiskPoolManagerFee);
GovernanceOperationMap.set(GovernanceLogType.NewFrontendOperator, handleNewFrontendOperator);
GovernanceOperationMap.set(GovernanceLogType.FrontendOperatorDisabled, handleFrontendOperatorDisabled);
GovernanceOperationMap.set(GovernanceLogType.FrontendOperatorEnabled, handleFrontendOperatorEnabled);
GovernanceOperationMap.set(GovernanceLogType.FrontendOperatorFee, handleFrontendOperatorFee);
GovernanceOperationMap.set(GovernanceLogType.ReferralFee, handleReferralFee);
GovernanceOperationMap.set(GovernanceLogType.PolicyBuyerReferralBonus, handlePolicyBuyerReferralBonus);
GovernanceOperationMap.set(GovernanceLogType.RiskPoolCap, handleRiskPoolCap);
GovernanceOperationMap.set(GovernanceLogType.FrontendOperatorPenalty, handleFrontendOperatorPenalty);
GovernanceOperationMap.set(GovernanceLogType.MarketFeeRecipient, handleMarketFeeRecipient);
GovernanceOperationMap.set(GovernanceLogType.PolicyBuyerReferralBonus, handlePolicyBuyerReferralBonus);
GovernanceOperationMap.set(GovernanceLogType.BridgeConnector, handleBridgeConnector);
GovernanceOperationMap.set(GovernanceLogType.ExternalRiskPoolsConfidenceInterval, handleExternalRiskPoolsConfidenceInterval);
GovernanceOperationMap.set(GovernanceLogType.SwapCycle, handleSwapCycle);
GovernanceOperationMap.set(GovernanceLogType.SettlementDiscount, handleSettlementDiscount);
GovernanceOperationMap.set(GovernanceLogType.ProductData, handleProductData);
GovernanceOperationMap.set(GovernanceLogType.ProductOperatorFeeRecipient, handleProductOperatorFeeRecipient);
GovernanceOperationMap.set(GovernanceLogType.MarketData, handleMarketData);

//#endregion

function handleUpdateNewOperator(event: LogGovernance): void {
  let config = getSystemConfig(event.address.toHexString());

  config.operator = event.params.param1;
  config.save();

  addEvent(EventType.NewOperator, event, null, config.id, event.params.param1.toHexString());
}

function handleUpdateExecutionDelay(event: LogGovernance): void {
  let config = getSystemConfig(event.address.toHexString());

  config.executionDelay = event.params.param3;
  config.save();

  addEvent(EventType.ExecutionDelay, event, null, config.id, event.params.param3.toString());
}

function handleUpdateNewAllowanceManager(event: LogGovernance): void {
  let config = getSystemConfig(event.address.toHexString());

  config.allowanceManager = event.params.param1;
  config.save();

  addEvent(EventType.AllowanceManager, event, null, config.id, event.params.param1.toHexString());
}

function handleUpdateTreasury(event: LogGovernance): void {
  let config = getSystemConfig(event.address.toHexString());

  config.treasury = event.params.param1;
  config.save();

  addEvent(EventType.Treasury, event, null, config.id, event.params.param1.toHexString());
}

function handleUpdateDefaultPayoutRequester(event: LogGovernance): void {
  let config = getSystemConfig(event.address.toHexString());

  config.defaultPayoutRequester = event.params.param1;
  config.save();

  addEvent(EventType.DefaultPayoutRequester, event, null, config.id, event.params.param1.toHexString());
}

function handleUpdateDefaultPayoutApprover(event: LogGovernance): void {
  let config = getSystemConfig(event.address.toHexString());

  config.defaultPayoutApprover = event.params.param1;
  config.save();

  addEvent(EventType.DefaultPayoutApprover, event, null, config.id, event.params.param1.toHexString());
}

function handleUpdateProductCreatorsAllowlistId(event: LogGovernance): void {
  let config = getSystemConfig(event.address.toHexString());

  config.productCreatorsAllowlistId = event.params.param3;
  config.save();

  addEvent(EventType.ProductCreatorsAllowlistId, event, null, config.id, event.params.param3.toString());
}

function handleUpdateGovernanceIncentiveFee(event: LogGovernance): void {
  let config = getSystemConfig(event.address.toHexString());

  config.governanceFee = event.params.param3;
  config.save();

  addEvent(EventType.GovernanceIncentiveFee, event, null, config.id, event.params.param3.toString());
}

function handleUpdateMaxProductOperatorIncentiveFee(event: LogGovernance): void {
  let config = getSystemConfig(event.address.toHexString());

  config.maxProductOperatorIncentiveFee = event.params.param3;
  config.save();

  addEvent(EventType.MaxProductOperatorIncentiveFee, event, null, config.id, event.params.param3.toString());
}

function handleUpdateMaxMarketOperatorIncentiveFee(event: LogGovernance): void {
  let productId = event.params.param3.toString();
  let fee = event.params.param4;
  let product = Product.load(productId);

  if (product != null) {
    product.maxMarketIncentiveFee = fee;
    product.save();

    return;
  }

  let config = getSystemConfig(event.address.toHexString());

  config.maxMarketOperatorIncentiveFee = fee;
  config.save();

  addEvent(EventType.MaxMarketOperatorIncentiveFee, event, null, config.id, fee.toString());
}

function handleUpdateExchangeRateOracle(event: LogGovernance): void {
  let config = getSystemConfig(event.address.toHexString());

  if (event.params.param5) {
    config.rateOracleList = addUniqueToList(config.rateOracleList, event.params.param1.toHexString());
  } else {
    config.rateOracleList = filterNotEqual(config.rateOracleList, event.params.param1.toHexString());
  }

  config.save();

  addEvent(
    event.params.param5 ? EventType.RegisterExchangeRateOracle : EventType.DeregisterExchangeRateOracle,
    event,
    null,
    config.id,
    event.params.param1.toHexString(),
  );
}

function handleUpdateCoverAdjusterOracle(event: LogGovernance): void {
  let config = getSystemConfig(event.address.toHexString());

  if (event.params.param5) {
    config.coverAdjusterOracleList = addUniqueToList(config.coverAdjusterOracleList, event.params.param1.toHexString());

    CoverAdjusterTemplate.create(event.params.param1);
  } else {
    config.coverAdjusterOracleList = filterNotEqual(config.coverAdjusterOracleList, event.params.param1.toHexString());
  }

  config.save();

  addEvent(
    event.params.param5 ? EventType.RegisterCoverAdjusterOracle : EventType.DeregisterCoverAdjusterOracle,
    event,
    null,
    config.id,
    event.params.param1.toHexString(),
  );
}

function handleSyncOracle(event: LogGovernance): void {
  let config = getSystemConfig(event.address.toHexString());

  if (event.params.param5) {
    config.syncOracleList = addUniqueToList(config.syncOracleList, event.params.param1.toHexString());
  } else {
    config.syncOracleList = filterNotEqual(config.syncOracleList, event.params.param1.toHexString());
  }

  config.save();

  addEvent(
    event.params.param5 ? EventType.RegisterSyncOracle : EventType.DeregisterSyncOracle,
    event,
    null,
    config.id,
    event.params.param1.toHexString(),
  );
}

function handleMarketDetails(event: LogGovernance): void {
  let id = event.address.toHexString() + "-" + event.params.param3.toString();
  let market = Market.load(id);
  let rpcContract = RiskPoolsControllerContract.bind(event.address);

  if (!market) {
    return;
  }

  market.details = getMarket(rpcContract, event.params.param3).details;

  market.save();
}

function handleMarketData(event: LogGovernance): void {
  let id = event.address.toHexString() + "-" + event.params.param3.toString();
  let market = Market.load(id);
  let rpcContract = RiskPoolsControllerContract.bind(event.address);

  if (!market) {
    return;
  }

  market.data = getMarket(rpcContract, event.params.param3).data;

  market.save();
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

    config.externalProductList = addUniqueToList(config.externalProductList, event.params.param1.toHexString());
  } else {
    config.externalProductList = filterNotEqual(config.externalProductList, event.params.param1.toHexString());
  }

  config.save();
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
    addOraclePair(market.rateOracle.toHexString(), market.capitalToken, market.premiumToken);
  }
  addOraclePair(market.rateOracle.toHexString(), market.premiumToken, Address.fromHexString(ETH_ADDRESS));
}

function handleUpdateRiskPoolWithdrawDelay(event: LogGovernance): void {
  let pool = Pool.load(event.params.param1.toHexString());

  if (!pool) {
    return;
  }

  pool.withdrawDelay = event.params.param3;

  pool.save();
}

function handleUpdateRiskPoolWithdrawRequestExpiration(event: LogGovernance): void {
  let pool = Pool.load(event.params.param1.toHexString());

  if (!pool) {
    return;
  }

  pool.withdrawRequestExpiration = event.params.param3;

  pool.save();
}

function handleUpdateMarketPolicyBuyerAllowListId(event: LogGovernance): void {
  let id = event.address.toHexString() + "-" + event.params.param3.toString();
  let market = Market.load(id);

  if (!market) {
    return;
  }

  market.policyBuyerAllowListId = event.params.param4;

  market.save();
}

function handleUpdateMarketPolicyBuyerAllowanceListId(event: LogGovernance): void {
  let id = event.address.toHexString() + "-" + event.params.param3.toString();
  let market = Market.load(id);

  if (!market) {
    return;
  }

  market.policyBuyerAllowanceListId = event.params.param4;

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
  let productId = event.params.param3;
  let product = Product.load(productId.toString());
  let rpcContract = RiskPoolsControllerContract.bind(event.address);

  if (!product) {
    return;
  }

  product.wording = getProductMeta(rpcContract, productId).wording;

  product.save();

  addEvent(EventType.ProductWording, event, null, product.id, product.wording);
}

function handleProductOperatorFeeRecipient(event: LogGovernance): void {
  let productId = event.params.param3;
  let product = Product.load(productId.toString());
  let rpcContract = RiskPoolsControllerContract.bind(event.address);

  if (!product) {
    return;
  }

  product.feeRecipient = getProduct(rpcContract, productId).productOperatorFeeRecipient;

  product.save();

  addEvent(EventType.ProductFeeRecipient, event, null, product.id, product.feeRecipient.toHexString());
}

function handleProductData(event: LogGovernance): void {
  let productId = event.params.param3;
  let product = Product.load(productId.toString());
  let rpcContract = RiskPoolsControllerContract.bind(event.address);

  if (!product) {
    return;
  }

  product.data = getProductMeta(rpcContract, productId).data;

  product.save();

  addEvent(EventType.ProductData, event, null, product.id, product.data);
}

function handleUpdateProductOperator(event: LogGovernance): void {
  let productId = event.params.param3.toString();
  let product = Product.load(productId);

  if (!product) {
    return;
  }

  product.operator = event.params.param2;

  product.save();

  addEvent(EventType.ProductOperator, event, null, product.id, product.operator.toHexString());
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
  let productId = event.params.param3.toString();
  let fee = event.params.param4;
  let product = Product.load(productId);

  if (!product) {
    return;
  }

  product.productIncentiveFee = fee;

  product.save();

  addEvent(EventType.ProductOperatorIncentiveFee, event, null, productId, fee.toString());
}

function handleUpdateProductMaxMarketIncentiveFee(event: LogGovernance): void {
  let productId = event.params.param3.toString();
  let fee = event.params.param4;
  let product = Product.load(productId);

  if (!product) {
    return;
  }

  product.maxMarketIncentiveFee = fee;
  product.save();

  addEvent(EventType.ProductMaxMarketOperatorIncentiveFee, event, null, productId, fee.toString());
}

function handleUpdateMarketOperatorIncentiveFee(event: LogGovernance): void {
  let id = event.address.toHexString() + "-" + event.params.param4.toString();
  let market = Market.load(id);

  if (!market) {
    return;
  }

  market.marketOperatorIncentiveFee = event.params.param3;

  market.save();
}

function handleUpdateLiquidationGasUsage(event: LogGovernance): void {
  let config = getSystemConfig(event.address.toHexString());

  config.liquidationGasUsage = event.params.param3;
  config.save();

  addEvent(EventType.LiquidationGasUsage, event, null, config.id, event.params.param3.toString());
}

function handleUpdateLiquidationIncentive(event: LogGovernance): void {
  let config = getSystemConfig(event.address.toHexString());

  config.liquidationIncentive = event.params.param3;
  config.save();

  addEvent(EventType.LiquidationIncentive, event, null, config.id, event.params.param3.toString());
}

function handleUpdateSolvencyMultiplier(event: LogGovernance): void {
  let config = getSystemConfig(event.address.toHexString());

  config.solvencyMultiplier = event.params.param3;
  config.save();

  addEvent(EventType.SolvencyMultiplier, event, null, config.id, event.params.param3.toString());
}

function handleUpdateMinPolicyDepositMultiplier(event: LogGovernance): void {
  let config = getSystemConfig(event.address.toHexString());

  config.minPolicyDepositMultiplier = event.params.param3;
  config.save();

  addEvent(EventType.MinPolicyDepositMultiplier, event, null, config.id, event.params.param3.toString());
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

function handleRiskPoolCap(event: LogGovernance): void {
  let pool = Pool.load(event.params.param1.toHexString());

  if (!pool) {
    return;
  }

  pool.capitalRequirement = event.params.param3;

  pool.save();
}

function handleFrontendOperatorPenalty(event: LogGovernance): void {
  let id = event.params.param1.toHexString() + "-" + event.params.param2.toHexString();
  let af = AccruedFee.load(id);

  if (af != null) {
    af.balance = event.params.param4;
    af.claimedBalance = af.claimedBalance.plus(event.params.param3);

    af.save();
  }
}

function handleMarketFeeRecipient(event: LogGovernance): void {
  let id = event.address.toHexString() + "-" + event.params.param3.toString();
  let market = Market.load(id);

  if (!market) {
    return;
  }

  market.marketFeeRecipient = event.params.param1;

  market.save();
}

function handleExternalRiskPoolsConfidenceInterval(event: LogGovernance): void {
  let config = getSystemConfig(event.address.toHexString());

  config.extPoolDetailsConfidenceInterval = event.params.param3;

  config.save();
}

function handleUpdateMaxRiskPoolManagerFee(event: LogGovernance): void {
  let config = getSystemConfig(event.address.toHexString());

  config.maxRiskPoolManagerFee = event.params.param3;

  config.save();

  addEvent(EventType.MaxRiskPoolManagerFee, event, null, config.id, event.params.param3.toString());
}

export function handleSettlementDiscount(event: LogGovernance): void {
  let id = event.address.toHexString() + "-" + event.params.param3.toString();
  let market = Market.load(id);

  if (!market) {
    return;
  }

  market.settlementDiscount = event.params.param4;

  market.save();
}

export function handleSwapCycle(event: LogGovernance): void {
  let config = getSystemConfig(event.address.toHexString());
  let rpcContract = RiskPoolsControllerContract.bind(event.address);

  config.swapCycleDuration = rpcContract.swapCycleDuration();
  config.swapDuration = rpcContract.swapDuration();
  config.idleDuration = rpcContract.idleDuration();

  config.save();

  addEvent(
    EventType.SwapCycle,
    event,
    null,
    config.id,
    config.swapCycleDuration.toString(),
    config.swapDuration.toString(),
    config.idleDuration.toString(),
  );
}

export function handleBridgeConnector(event: LogGovernance): void {
  let config = getSystemConfig(event.address.toHexString());

  config.bridgeConnector = event.params.param1;

  config.save();
}
