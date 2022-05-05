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
  Market,
  Policy,
  Pool,
  PoolMarketRelation,
  Product,
} from "../generated/schema";
import { Pool as PoolTemplate } from "../generated/templates";
import {
  addEvent,
  EventType,
  StatusEnum,
  updateAndLogState,
  updateState,
} from "./event";
import {
  Address,
  BigInt,
  Bytes,
  ethereum,
  log,
  store,
} from "@graphprotocol/graph-ts";
import { addOraclePair } from "./rate-oracle";
import {
  getMarket,
  getMarketMeta,
  getPolicy,
  getPolicyDeposit,
} from "./contract-mapper";

export const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function handleLogNewMarket(event: LogNewMarket): void {
  let marketId = event.params.marketId;
  let product = Product.load(event.address.toHexString())!;
  let rpcContract = RiskPoolsControllerContract.bind(
    changetype<Address>(product.riskPoolsControllerAddress)
  );

  let id =
    product.riskPoolsControllerAddress.toHexString() +
    "-" +
    marketId.toString();
  let market = new Market(id);
  let marketInfo = getMarket(rpcContract, marketId);
  let marketMeta = getMarketMeta(rpcContract, marketId);
  let productInfo = rpcContract.products(event.address);
  let titleParams = marketInfo.title.split("+");

  market.marketId = marketId;
  market.product = event.address.toHexString();
  market.riskPoolsControllerAddress = product.riskPoolsControllerAddress;

  market.wording = productInfo.value0;
  market.entityList = titleParams.filter((t, i, a) => i != a.length - 1);
  market.details =
    titleParams.length > 0 ? titleParams[titleParams.length - 1] : null;

  market.exposure = marketMeta.desiredCover;
  market.actualCover = marketMeta.actualCover;
  market.waitingPeriod = marketMeta.waitingPeriod;
  market.marketOperatorIncentiveFee = marketMeta.marketOperatorIncentiveFee;
  market.latestAccruedTimestamp = marketMeta.accrualBlockNumberPrior;
  market.settlementDiscount = marketMeta.settlementDiscount;

  market.author = marketInfo.marketOperator;
  market.premiumToken = marketInfo.premiumToken;
  market.capitalToken = marketInfo.capitalToken;
  market.insuredToken = marketInfo.insuredToken;
  market.coverAdjusterOracle = marketInfo.coverAdjusterOracle;
  market.rateOracle = marketInfo.ratesOracle;
  market.title = marketInfo.title;
  market.isEnabled = rpcContract.marketStatus(marketId) == 0;

  market.policyBuyerAllowListId = rpcContract.policyBuyerAllowlistId(marketId);
  market.premiumMulAccumulator =
    rpcContract.marketsPremiumMulAccumulators(marketId);
  market.createdAt = event.block.timestamp;

  market.pools = [];
  market.poolMarketRelations = [];
  market.status = StatusEnum.Opened;

  market.save();

  if (market.rateOracle) {
    addOraclePair(
      market.rateOracle!.toHexString(),
      market.capitalToken,
      market.premiumToken
    );
    addOraclePair(
      market.rateOracle!.toHexString(),
      market.premiumToken,
      Address.fromHexString(ETH_ADDRESS)
    );

    if (market.insuredToken != Address.fromHexString(ZERO_ADDRESS)) {
      addOraclePair(
        market.rateOracle!.toHexString(),
        market.capitalToken,
        market.insuredToken
      );
    }
  }

  let currentLevel = rpcContract.riskTowerBase(marketId);
  let levelNo: i32 = 1;

  while (!currentLevel.isZero()) {
    let pools = rpcContract.riskPoolsAtLevel(marketId, currentLevel);

    for (let i = 0; i < pools.length; i++) {
      createPool(pools[i], event);
      addPoolToMarket(pools[i], id, event, currentLevel, levelNo);
    }

    levelNo++;
    currentLevel = rpcContract.nextLevelId(marketId, currentLevel);
  }

  updateAndLogState(EventType.TotalMarkets, event, BigInt.fromI32(1), null);
  addEvent(EventType.NewMarket, event, id, market.title);
}

export function createPool(
  poolId: Address,
  event: ethereum.Event
): void {
  let pool = new Pool(poolId.toHexString());
  let pContract = PoolContract.bind(poolId);
  let btContract = PoolContract.bind(pContract.assetToken()); // It is also ERC20
  let premiumRate = !pContract.try_currentPremiumRate().reverted
    ? pContract.currentPremiumRate()
    : BigInt.fromI32(0);

  pool.riskPoolsControllerAddress = pContract.controller();
  pool.name = pContract.name();
  pool.capitalTokenAddress = pContract.assetToken();
  pool.capitalTokenBalance = BigInt.fromI32(1);
  pool.poolTokenBalance = BigInt.fromI32(1);
  pool.participants = BigInt.fromI32(0);
  pool.createdAt = event.block.timestamp;
  pool.createdBy = event.transaction.from;
  pool.updatedAt = event.block.timestamp;
  pool.poolTokenDecimals = !pContract.try_decimals().reverted
    ? pContract.try_decimals().value
    : 18;
  pool.poolTokenSymbol = !pContract.try_symbol().reverted
    ? pContract.try_symbol().value
    : "";
  pool.managerFee = pContract.managerFee();
  pool.capitalTokenDecimals = !btContract.try_decimals().reverted
    ? btContract.try_decimals().value
    : 18;
  pool.capitalTokenSymbol = !btContract.try_symbol().reverted
    ? btContract.try_symbol().value
    : "";
  pool.premiumRate = premiumRate;
  pool.exposure = BigInt.fromI32(0);
  pool.capitalRequirement = BigInt.fromI32(0);
  pool.mcr = pContract.mcr();
  pool.capacity = pool.capitalTokenBalance.times(pool.mcr!);
  pool.markets = [];
  pool.withdrawDelay = pContract.withdrawDelay();
  pool.premiumRateModel = pContract.premiumRateModel();
  pool.lpAllowListId = pContract.allowlistId();
  pool.rewards = [];
  pool.externalPoolList = [];
  pool.externalCapacity = BigInt.fromI32(0);
  pool.externalCoverage = BigInt.fromI32(0);
  pool.totalTransferredOut = BigInt.fromI32(0);
  pool.physicalSettlementMarketCount = 0;

  pool.save();

  PoolTemplate.create(poolId);

  addEvent(
    EventType.PoolPremiumRate,
    event,
    null,
    pool.id,
    premiumRate.toString()
  );
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

export function addPoolToMarket(
  poolId: Address,
  marketId: string,
  event: ethereum.Event,
  levelId: BigInt,
  levelNo: i32,
  rpcAddress: Address | null = null
): void {
  let pool = Pool.load(poolId.toHexString());
  let market = Market.load(marketId);
  let pContract = PoolContract.bind(poolId);

  if (!market) {
    return;
  }

  if (!pool) {
    log.warning("No pool found {}", [poolId.toHexString()]);
    return;
  }

  let pools = market.pools;
  let exposures = market.poolMarketRelations;

  if (pools != null && pools.indexOf(poolId.toHexString()) > -1) {
    return;
  }

  if (pools === null) {
    pools = [];
  }

  let pMarkets = pool.markets;

  pMarkets.push(marketId);

  pool.markets = pMarkets;
  pool.productId = market.product;

  if (market.insuredToken.toHexString() != ZERO_ADDRESS) {
    pool.physicalSettlementMarketCount += 1;
  }

  if (!pool.market || pool.market == "") {
    pool.market = marketId;
    pool.num = pools.length + 1;
  }

  pool.save();

  let address = rpcAddress;

  if (!address) {
    let product = Product.load(event.address.toHexString());

    if (product != null) {
      address = changetype<Address>(product.riskPoolsControllerAddress);
    } else {
      return;
    }
  }

  let rpcContract = RiskPoolsControllerContract.bind(address);
  let pmeId = pool.id + "-" + marketId;
  let pme = new PoolMarketRelation(pmeId);
  let allowanceResult = rpcContract.try_marketCapacityAllowances(
    poolId,
    market.marketId
  );

  pme.exposure = pContract.internalCoverPerMarket(market.marketId);
  pme.rate = pool.premiumRate;
  pme.poolId = pool.id;
  pme.pool = pool.id;
  pme.market = marketId;
  pme.allowance = allowanceResult.reverted
    ? BigInt.fromI32(0)
    : allowanceResult.value;
  pme.levelNo = levelNo;
  pme.levelId = levelId;

  pme.save();

  pools.push(poolId.toHexString());
  market.pools = pools;

  exposures.push(pmeId);
  market.poolMarketRelations = exposures;

  market.save();

  updateAndLogState(
    EventType.MarketCapacity,
    event,
    pool.capacity,
    marketId,
    pool.capitalTokenAddress.toHexString()
  );

  if (market.rateOracle) {
    addOraclePair(
      market.rateOracle!.toHexString(),
      market.capitalToken,
      pool.capitalTokenAddress
    );
    addOraclePair(
      market.rateOracle!.toHexString(),
      market.premiumToken,
      pool.capitalTokenAddress
    );
  }
}

export function removePoolFromMarket(
  poolId: string,
  marketId: string,
  event: ethereum.Event
): void {
  let pool = Pool.load(poolId);
  let market = Market.load(marketId);

  if (!market) {
    return;
  }

  if (!pool) {
    log.warning("No pool found {}", [poolId]);
    return;
  }

  let pmeId = pool.id + "-" + marketId;

  pool.markets = filterNotEqual(pool.markets, marketId);

  if (market.insuredToken.toHexString() != ZERO_ADDRESS) {
    pool.physicalSettlementMarketCount -= 1;
  }

  market.pools = filterNotEqual(market.pools, poolId);
  market.poolMarketRelations = filterNotEqual(
    market.poolMarketRelations,
    pmeId
  );

  pool.save();
  market.save();

  store.remove("PoolMarketRelation", pmeId);

  updateAndLogState(
    EventType.MarketCapacity,
    event,
    pool.capacity.neg(),
    marketId,
    pool.capitalTokenAddress.toHexString()
  );
}

export function filterNotEqual(array: string[], item: string): string[] {
  let res: string[] = [];

  for (let i = 0; i < array.length; i++) {
    if (array[i] != item) {
      res.push(array[i]);
    }
  }

  return res;
}

export function removePoolsAtLevel(
  level: BigInt,
  marketId: string,
  event: ethereum.Event,
  poolList: string[] | null = null
): void {
  let market = Market.load(marketId);
  let pmrList = market!.poolMarketRelations;

  for (let i = 0; i < pmrList.length; i++) {
    let pmr = PoolMarketRelation.load(pmrList[i]);

    if (
      pmr !== null &&
      pmr.levelId !== null &&
      pmr.levelId! == level &&
      (poolList === null || poolList.includes(pmr.poolId))
    ) {
      removePoolFromMarket(pmr.poolId, marketId, event);
    }
  }
}

export function handleLogNewPolicy(event: LogNewPolicy): void {
  let policyId = event.params.policyId;
  let productContract = ProductContract.bind(event.address);
  let rpcContract = RiskPoolsControllerContract.bind(
    productContract.riskPoolsController()
  );
  let piContract = PolicyTokenIssuerContract.bind(
    rpcContract.policyTokenIssuer()
  );
  let policyInfo = getPolicy(rpcContract, policyId);
  let marketInfo = getMarket(rpcContract, event.params.marketId);
  let policyBalance = rpcContract.policyBalance(policyId, marketInfo.premiumToken);
  let depositInfo = getPolicyDeposit(rpcContract, policyId, marketInfo.premiumToken);

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
    productContract.riskPoolsController().toHexString() +
    "-" +
    policyInfo.marketId.toString();
  policy.validUntil = policyInfo.validUntil;
  policy.validFrom = event.block.timestamp;
  policy.coverageChanged = policyInfo.coverChanged;
  policy.issuer = policyInfo.issuer.toHexString();
  policy.owner = piContract.ownerOf(policyId).toHexString();
  policy.waitingPeriod = policyInfo.waitingPeriod;
  policy.foAddress = policyInfo.frontendOperator;
  policy.foFeeRate = policyInfo.frontendOperatorFee;
  policy.referralAddress = policyInfo.referral;
  policy.referralFeeRate = policyInfo.referralFee;
  policy.coverage = policyInfo.desiredCover;
  policy.underlyingCover = policyInfo.underlyingCover;
  policy.expired = policy.coverage.equals(BigInt.fromI32(0));

  policy.totalCharged = BigInt.fromI32(0);

  policy.updatedAt = event.block.timestamp;

  policy.save();

  let market = Market.load(policy.market)!;

  market.exposure = market.exposure.plus(policy.coverage);

  market.save();

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

  updateState(
    EventType.SystemDesiredCoverage,
    policy.coverage,
    null,
    market.capitalToken.toHexString()
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

  switch (event.params.prop) {
    case UintProp.WithdrawalDelay:
      product.withdrawalDelay = event.params.value;
      break;
    case UintProp.WaitingPeriod:
      product.waitingPeriod = event.params.value;
      break;
    case UintProp.MarketCreationFeeAmount:
      product.marketCreationFeeAmount = event.params.value;
      break;
    case UintProp.MarketCreatorsAllowlistId:
      product.marketCreatorsAllowlistId = event.params.value;
      break;

    default:
      log.warning("Unknown product uint prop update {}", [
        event.params.prop.toString(),
      ]);
  }

  product.updatedAt = event.block.timestamp;

  product.save();
}

export function handleLogAddressPropUpdated(
  event: LogAddressPropUpdated
): void {
  let product = Product.load(event.address.toHexString())!;

  switch (event.params.prop) {
    case AddressProp.DefaultRatesOracle:
      product.defaultRatesOracle = event.params.value;
      break;
    case AddressProp.FeeToken:
      product.feeToken = event.params.value;
      break;
    case AddressProp.DefaultCoverAdjusterOracle:
      product.defaultCoverAdjusterOracle = event.params.value;
      break;
    case AddressProp.DefaultCapitalToken:
      product.defaultCapitalToken = event.params.value;
      break;
    case AddressProp.DefaultPremiumToken:
      product.defaultPremiumToken = event.params.value;
      break;
    case AddressProp.PayoutRequester:
      product.payoutRequester = event.params.value;
      break;
    case AddressProp.PayoutApprover:
      product.payoutApprover = event.params.value;
      break;
    case AddressProp.ProductOperator:
      product.operator = event.params.value;
      break;
    case AddressProp.ClaimProcessor:
      product.claimProcessor = event.params.value;
      break;
    default:
      log.warning("Unknown product address prop update {}", [
        event.params.prop.toString(),
      ]);
  }

  product.updatedAt = event.block.timestamp;

  product.save();
}
