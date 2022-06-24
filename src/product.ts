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
  Product,
  RiskTowerLevel,
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
  ethereum,
  log,
} from "@graphprotocol/graph-ts";
import { addOraclePair } from "./rate-oracle";
import {
  getMarket,
  getMarketMeta,
  getPolicy,
  getPolicyDeposit,
  getRiskPoolData,
  getRiskTowerLevel,
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

  market.status = StatusEnum.Opened;
  market.riskTowerRoot = marketMeta.riskTowerRootLevel;

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

  let currentLevel = market.riskTowerRoot!;
  let levelNo: i32 = 1;

  while (!currentLevel.isZero()) {
    let level = new RiskTowerLevel(currentLevel.toString());

    level.market = id;
    level.levelNo = levelNo;

    level.save();

    levelNo++;
    currentLevel = getRiskTowerLevel(rpcContract, currentLevel).nextRiskTowerLevelId;
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
  let rpcContract = RiskPoolsControllerContract.bind(pContract.controller());
  let riskPoolData = getRiskPoolData(rpcContract, poolId);

  pool.riskPoolsControllerAddress = pContract.controller();
  pool.name = pContract.name();
  pool.capitalTokenAddress = pContract.assetToken();
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
  pool.rewards = [];
  pool.externalPoolList = [];
  pool.externalCapacity = BigInt.fromI32(0);
  pool.externalCoverage = BigInt.fromI32(0);
  pool.totalTransferredOut = BigInt.fromI32(0);
  pool.physicalSettlementMarketCount = 0;

  pool.save();

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


export function filterNotEqual(array: string[], item: string): string[] {
  let res: string[] = [];

  for (let i = 0; i < array.length; i++) {
    if (array[i] != item) {
      res.push(array[i]);
    }
  }

  return res;
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
