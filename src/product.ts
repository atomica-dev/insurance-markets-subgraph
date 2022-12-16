import {
  LogAddressPropUpdated,
  LogNewMarket,
  LogNewPolicy,
  LogUintPropUpdated,
  Product as ProductContract,
} from "../generated/templates/Product/Product";
import { RiskPoolsController as RiskPoolsControllerContract } from "../generated/templates/Product/RiskPoolsController";
import { PolicyTokenIssuer as PolicyTokenIssuerContract } from "../generated/templates/Product/PolicyTokenIssuer";
import { Pool as PoolContract } from "../generated/templates/Product/Pool";
import {
  FeeRecipientPool,
  Market,
  Policy,
  Pool,
  Product,
} from "../generated/schema";
import { Pool as PoolTemplate } from "../generated/templates";
import {
  addEvent,
  EventType,
  getState,
  StatusEnum,
  updateAndLogState,
  updateState,
} from "./event";
import { Address, BigInt, Bytes, ethereum, log } from "@graphprotocol/graph-ts";
import { addOraclePair } from "./rate-oracle";
import {
  getMarket,
  getMarketMeta,
  getPolicy,
  getPolicyDeposit,
  getRiskPoolData,
} from "./contract-mapper";
import {
  addUniqueToList,
  ETH_ADDRESS,
  filterNotEqual,
  ZERO_ADDRESS,
} from "./utils";
import { createAggregatedPool, updateMarketChargeState } from "./risk-pools-controller";

export function handleLogNewMarket(event: LogNewMarket): void {
  let marketId = event.params.marketId;
  let product = Product.load(event.address.toHexString())!;
  let rpcContractAddress = changetype<Address>(product.riskPoolsControllerAddress);
  let rpcContract = RiskPoolsControllerContract.bind(rpcContractAddress);

  let id = rpcContractAddress.toHexString() + "-" + marketId.toString();
  let market = new Market(id);
  let marketInfo = getMarket(rpcContract, marketId);
  let marketMeta = getMarketMeta(rpcContract, marketId);
  let productInfo = rpcContract.products(event.address);
  let titleParams = marketInfo.title.split("+");

  market.marketId = marketId;
  market.product = event.address.toHexString();
  market.riskPoolsControllerAddress = rpcContractAddress;

  market.wording = productInfo.value0;
  market.entityList = titleParams.filter((t, i, a) => i != a.length - 1);
  market.details =
    titleParams.length > 0 ? titleParams[titleParams.length - 1] : null;

  market.waitingPeriod = marketMeta.waitingPeriod;
  market.marketOperatorIncentiveFee = marketMeta.marketOperatorIncentiveFee;
  market.latestAccruedTimestamp = marketMeta.lastChargeTimestamp;
  market.settlementDiscount = marketMeta.settlementDiscount;

  market.author = marketInfo.marketOperator;
  market.marketFeeRecipient = marketInfo.marketFeeRecipient;
  market.premiumToken = marketInfo.premiumToken;
  market.capitalToken = marketInfo.capitalToken;
  market.insuredToken = marketInfo.insuredToken;
  market.coverAdjusterOracle = marketInfo.coverAdjusterOracle;
  market.rateOracle = marketInfo.ratesOracle;
  market.title = marketInfo.title;
  market.isEnabled = rpcContract.marketStatus(marketId) == 0;

  market.totalCapacity = marketMeta.totalCapacity;
  market.desiredCover = marketMeta.desiredCover;
  market.waitingPeriod = marketMeta.waitingPeriod;
  market.withdrawDelay = marketMeta.withdrawDelay;
  market.headAggregatedPoolId = marketMeta.headAggregatedPoolId;
  market.tailCover = marketMeta.tailCover;
  market.maxPremiumRatePerSec = marketMeta.maxPremiumRatePerSec;
  market.bidStepPremiumRatePerSec = marketMeta.bidStepPremiumRatePerSec;
  market.maxAggregatedPoolSlots = marketMeta.maxAggregatedPoolSlots;
  market.tailKink = marketMeta.tailKink;
  market.tailJumpPremiumRatePerSec = marketMeta.tailJumpPremiumRatePerSec;

  market.policyBuyerAllowListId = rpcContract.policyBuyerAllowlistId(marketId);
  market.policyBuyerAllowanceListId = rpcContract.policyBuyerAllowanceListId(marketId);
  market.premiumMulAccumulator = rpcContract.marketsPremiumMulAccumulators(
    marketId
  );
  market.createdAt = event.block.timestamp;

  market.status = StatusEnum.Opened;

  market.save();

  createAggregatedPool(market.headAggregatedPoolId, rpcContractAddress);

  if (market.rateOracle) {
    addOraclePair(
      market.rateOracle.toHexString(),
      market.capitalToken,
      market.premiumToken
    );
    addOraclePair(
      market.rateOracle.toHexString(),
      market.premiumToken,
      Address.fromHexString(ETH_ADDRESS)
    );

    if (market.insuredToken != Address.fromHexString(ZERO_ADDRESS)) {
      addOraclePair(
        market.rateOracle.toHexString(),
        market.capitalToken,
        market.insuredToken
      );
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
  pool.manager = riskPoolData.manager;
  pool.feeRecipient = riskPoolData.managerFeeRecipient;
  pool.updatedAt = event.block.timestamp;
  pool.poolTokenDecimals = !pContract.try_decimals().reverted
    ? pContract.try_decimals().value
    : 18;
  pool.poolTokenSymbol = !pContract.try_symbol().reverted
    ? pContract.try_symbol().value
    : "";
  pool.managerFee = riskPoolData.managerFee;
  pool.agreement = riskPoolData.agreement;
  pool.capitalTokenDecimals = !btContract.try_decimals().reverted
    ? btContract.try_decimals().value
    : 18;
  pool.capitalTokenSymbol = !btContract.try_symbol().reverted
    ? btContract.try_symbol().value
    : "";
  pool.capitalRequirement = pContract.cap();
  pool.markets = [];
  pool.withdrawRequestExpiration = pContract.withdrawRequestExpiration();
  pool.withdrawDelay = pContract.withdrawDelay();
  pool.lpAllowListId = pContract.allowlistId();
  //TODO: UNCOMMENT once contract issue is fixed.
  //pool.lpAllowanceListId = pContract.allowanceListId();
  pool.rewards = [];
  pool.externalPoolList = [];
  pool.externalCapacity = BigInt.fromI32(0);
  pool.totalTransferredOut = BigInt.fromI32(0);
  pool.physicalSettlementMarketCount = 0;

  pool.save();

  updateFeeRecipientRelation(pool.feeRecipient, poolId);

  PoolTemplate.create(poolId);

  addEvent(
    EventType.PoolBalance,
    event,
    null,
    pool.id,
    pool.poolTokenBalance.toString(),
    pool.capitalTokenBalance.toString(),
    pool.poolTokenBalance.toString()
  );
  updateState(EventType.SystemPoolCount, BigInt.fromI32(1), null);
}

export function updateFeeRecipientRelation(
  feeRecipientId: Bytes,
  riskPoolId: Bytes,
  oldFeeRecipient: Bytes | null = null
): void {
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
  let productContract = ProductContract.bind(event.address);
  let rpcAddress = productContract.riskPoolsController();
  let rpcContract = RiskPoolsControllerContract.bind(rpcAddress);
  let piContract = PolicyTokenIssuerContract.bind(
    rpcContract.policyTokenIssuer()
  );
  let policyInfo = getPolicy(rpcContract, policyId);
  let marketInfo = getMarket(rpcContract, event.params.marketId);
  let policyBalance = rpcContract.policyBalance(
    policyId,
    marketInfo.premiumToken
  );
  let depositInfo = getPolicyDeposit(
    rpcContract,
    policyId,
    marketInfo.premiumToken
  );

  let id =
    rpcContract.policyTokenIssuer().toHexString() + "-" + policyId.toString();
  let policy = new Policy(id);

  policy.policyTokenIssuerAddress = rpcContract.policyTokenIssuer();
  policy.policyId = policyId;
  policy.productId = event.address.toHexString();
  policy.originalBalance = depositInfo.premiumFeeDeposit
    .plus(depositInfo.frontendOperatorFeeDeposit)
    .plus(depositInfo.referralFeeDeposit);
  policy.balance = policyBalance;
  policy.premiumDeposit = depositInfo.premiumFeeDeposit;
  policy.foFeeDeposit = depositInfo.frontendOperatorFeeDeposit;
  policy.initialMarketPremiumMulAccumulator = depositInfo.premiumMulAccumulator;
  policy.referralFeeDeposit = depositInfo.referralFeeDeposit;

  policy.marketId = policyInfo.marketId;
  policy.market =
    rpcAddress.toHexString() + "-" + policyInfo.marketId.toString();
  policy.validUntil = policyInfo.validUntil;
  policy.validFrom = event.block.timestamp;
  policy.coverageChanged = policyInfo.coverChanged;
  policy.issuer = policyInfo.issuer.toHexString();
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

  if (
    getState(EventType.TotalPolicies, policy.market).value == BigInt.fromI32(0)
  ) {
    // Until contract issue is fixed it's required to call update coverage manually.
    updateMarketChargeState(rpcAddress, policy.market, event);
  }

  addEvent(
    EventType.NewPolicy,
    event,
    policy.market,
    policy.id,
    policy.balance.toString(),
    policy.coverage.toString()
  );
  updateAndLogState(
    EventType.TotalPolicies,
    event,
    BigInt.fromI32(1),
    policy.market
  );
  updateAndLogState(
    EventType.MarketExposure,
    event,
    policy.coverage,
    policy.market
  );

  updateAndLogState(
    EventType.MarketPolicyPremium,
    event,
    policy.premiumDeposit,
    policy.market
  );
}

enum UintProp {
  WithdrawalDelay,
  WaitingPeriod,
  MarketCreationFeeAmount,
  MarketCreatorsAllowlistId,
}

enum AddressProp {
  DefaultRatesOracle,
  FeeToken,
  DefaultCoverAdjusterOracle,
  DefaultCapitalToken,
  DefaultPremiumToken,
  PayoutRequester,
  PayoutApprover,
  ClaimProcessor,
  ProductOperator,
  Operator,
}

export function handleLogUintPropUpdated(event: LogUintPropUpdated): void {
  let product = Product.load(event.address.toHexString())!;

  let eventType: EventType = -1;

  switch (event.params.prop) {
    case UintProp.WithdrawalDelay:
      product.withdrawalDelay = event.params.value;
      eventType = EventType.WithdrawalDelay;
      break;
    case UintProp.WaitingPeriod:
      product.waitingPeriod = event.params.value;
      eventType = EventType.WaitingPeriod;
      break;
    case UintProp.MarketCreationFeeAmount:
      product.marketCreationFeeAmount = event.params.value;
      eventType = EventType.MarketCreationFeeAmount;
      break;
    case UintProp.MarketCreatorsAllowlistId:
      product.marketCreatorsAllowlistId = event.params.value;
      eventType = EventType.MarketCreatorsAllowList;
      break;

    default:
      log.warning("Unknown product uint prop update {}", [
        event.params.prop.toString(),
      ]);
  }

  product.updatedAt = event.block.timestamp;

  product.save();

  if (eventType >= 0) {
    addEvent(
      eventType,
      event,
      null,
      event.address.toHexString(),
      event.params.value.toString()
    );
  }
}

export function handleLogAddressPropUpdated(
  event: LogAddressPropUpdated
): void {
  let product = Product.load(event.address.toHexString())!;

  let eventType: EventType = -1;

  switch (event.params.prop) {
    case AddressProp.DefaultRatesOracle:
      product.defaultRatesOracle = event.params.value;
      eventType = EventType.DefaultRatesOracle;
      break;
    case AddressProp.FeeToken:
      product.feeToken = event.params.value;
      eventType = EventType.FeeToken;
      break;
    case AddressProp.DefaultCoverAdjusterOracle:
      product.defaultCoverAdjusterOracle = event.params.value;
      eventType = EventType.DefaultCoverAdjusterOracle;
      break;
    case AddressProp.DefaultCapitalToken:
      product.defaultCapitalToken = event.params.value;
      eventType = EventType.DefaultCapitalToken;
      break;
    case AddressProp.DefaultPremiumToken:
      product.defaultPremiumToken = event.params.value;
      eventType = EventType.DefaultPremiumToken;
      break;
    case AddressProp.PayoutRequester:
      product.payoutRequester = event.params.value;
      eventType = EventType.PayoutRequester;
      break;
    case AddressProp.PayoutApprover:
      product.payoutApprover = event.params.value;
      eventType = EventType.PayoutApprover;
      break;
    case AddressProp.ProductOperator:
      product.operator = event.params.value;
      eventType = EventType.ProductOperator;
      break;
    case AddressProp.ClaimProcessor:
      product.claimProcessor = event.params.value;
      eventType = EventType.ClaimProcessor;
      break;
    default:
      log.warning("Unknown product address prop update {}", [
        event.params.prop.toString(),
      ]);
  }

  product.updatedAt = event.block.timestamp;

  product.save();

  if (eventType >= 0) {
    addEvent(
      eventType,
      event,
      null,
      event.address.toHexString(),
      event.params.value.toHexString()
    );
  }
}
