import { BigInt } from "@graphprotocol/graph-ts"
import {
  RiskPoolsController,
  LogFeeAccrued,
  LogForwardedPayoutRequestDeclined,
  LogForwardedPayoutRequestProcessed,
  LogGovernance,
  LogLiquidation,
  LogMarketIncentiveFeeUpdated,
  LogMarketPolicyBuyerAllowlistIdChanged,
  LogMarketStatusChanged,
  LogNewDistributor,
  LogNewForwardedPayoutRequest,
  LogNewLevel,
  LogNewMarketCreated,
  LogNewMarketStatus,
  LogNewPayoutRequest,
  LogNewPool,
  LogNewProduct,
  LogNewProductStatus,
  LogNewSystemStatus,
  LogNextLevelAdded,
  LogNextLevelRemoved,
  LogPayout,
  LogPermissionTokenIssued,
  LogPermissionTokenRevoked,
  LogPolicyCoverChanged,
  LogPolicyDeposit,
  LogPolicyWithdraw,
  LogPoolAddedToMarket,
  LogPremiumEarned,
  LogRiskPoolAddedToLevel,
  LogRiskPoolRemovedFromLevel,
  LogSwap,
  LogWithdrawFee
} from "../generated/RiskPoolsController/RiskPoolsController"
import { ExampleEntity } from "../generated/schema"

export function handleLogFeeAccrued(event: LogFeeAccrued): void {
  // Entities can be loaded from the store using a string ID; this ID
  // needs to be unique across all entities of the same type
  let entity = ExampleEntity.load(event.transaction.from.toHex())

  // Entities only exist after they have been saved to the store;
  // `null` checks allow to create entities on demand
  if (!entity) {
    entity = new ExampleEntity(event.transaction.from.toHex())

    // Entity fields can be set using simple assignments
    entity.count = BigInt.fromI32(0)
  }

  // BigInt and BigDecimal math are supported
  entity.count = entity.count + BigInt.fromI32(1)

  // Entity fields can be set based on event parameters
  entity.policyId = event.params.policyId
  entity.premiumToken = event.params.premiumToken

  // Entities can be written to the store with `.save()`
  entity.save()

  // Note: If a handler doesn't require existing field values, it is faster
  // _not_ to load the entity from the store. Instead, create it fresh with
  // `new Entity(...)`, set the fields that should be updated and save the
  // entity back to the store. Fields that were not set or unset remain
  // unchanged, allowing for partial updates to be applied.

  // It is also possible to access smart contracts from mappings. For
  // example, the contract that has emitted the event can be connected to
  // with:
  //
  // let contract = Contract.bind(event.address)
  //
  // The following functions can then be called on this contract to access
  // state variables and other data:
  //
  // - contract.accruedFees(...)
  // - contract.allowlist(...)
  // - contract.availableCapacity(...)
  // - contract.bridgeConnector(...)
  // - contract.capitalToken(...)
  // - contract.checkSwapFeasibility(...)
  // - contract.connectedCapacityDetailsConfidenceInterval(...)
  // - contract.conversionQuote(...)
  // - contract.coverAdjusterOracles(...)
  // - contract.createDistributor(...)
  // - contract.createMarket(...)
  // - contract.createRiskPool(...)
  // - contract.cumulatedPremium(...)
  // - contract.defaultPayoutApprover(...)
  // - contract.defaultPayoutRequester(...)
  // - contract.depositAndWithdrawPeriod(...)
  // - contract.depositPolicy(...)
  // - contract.exchangeRateOracles(...)
  // - contract.forwardedPayoutRequestId(...)
  // - contract.forwardedPayoutRequests(...)
  // - contract.frontendOperators(...)
  // - contract.getAllowanceFromAllowlist(...)
  // - contract.governanceIncentiveFee(...)
  // - contract.healthStatus(...)
  // - contract.idleDuration(...)
  // - contract.issuePermission(...)
  // - contract.issuePolicy(...)
  // - contract.lastMarketId(...)
  // - contract.lastPoolId(...)
  // - contract.levels(...)
  // - contract.liquidationGasUsage(...)
  // - contract.liquidationIncentive(...)
  // - contract.marketCapacityAllowances(...)
  // - contract.marketDeposits(...)
  // - contract.marketIsOpened(...)
  // - contract.marketLevelIdInc(...)
  // - contract.marketLevels(...)
  // - contract.marketPayoutAvailable(...)
  // - contract.marketRiskPools(...)
  // - contract.marketStatus(...)
  // - contract.marketWithdrawAvailable(...)
  // - contract.marketWithdrawLPAvailable(...)
  // - contract.marketWithdrawPolicyAvailable(...)
  // - contract.markets(...)
  // - contract.marketsMeta(...)
  // - contract.marketsPremiumMulAccumulators(...)
  // - contract.maxMarketOperatorIncentiveFee(...)
  // - contract.maxProductOperatorIncentiveFee(...)
  // - contract.minPolicyDeposit(...)
  // - contract.minPolicyDepositMultiplier(...)
  // - contract.nextLevelId(...)
  // - contract.operator(...)
  // - contract.ownerOf(...)
  // - contract.payoutExternalRecipient(...)
  // - contract.payoutRequestInc(...)
  // - contract.payoutRequestRecipient(...)
  // - contract.payoutRequests(...)
  // - contract.permissionIdToPolicyId(...)
  // - contract.policies(...)
  // - contract.policyBalance(...)
  // - contract.policyBuyerAllowlistId(...)
  // - contract.policyDeposits(...)
  // - contract.policyTokenIssuer(...)
  // - contract.policyTokenPermissionIssuer(...)
  // - contract.poolMarkets(...)
  // - contract.poolMarketsIndexes(...)
  // - contract.premiumRateModels(...)
  // - contract.premiumToken(...)
  // - contract.productCreatorsAllowlistId(...)
  // - contract.productIsOpened(...)
  // - contract.products(...)
  // - contract.quote(...)
  // - contract.referralBonus(...)
  // - contract.riskPoolMarkets(...)
  // - contract.riskPoolMarketsAreOpened(...)
  // - contract.riskPoolWithdrawLPAvailable(...)
  // - contract.riskPoolsAtLevel(...)
  // - contract.riskTowerBase(...)
  // - contract.riskTowers(...)
  // - contract.solvencyMultiplier(...)
  // - contract.solvencyRequirement(...)
  // - contract.swap(...)
  // - contract.swapCycleDuration(...)
  // - contract.swapDuration(...)
  // - contract.swapPeriod(...)
  // - contract.syncOracles(...)
  // - contract.systemIsOpened(...)
  // - contract.systemStatus(...)
  // - contract.treasury(...)
  // - contract.wallet(...)
}

export function handleLogForwardedPayoutRequestDeclined(
  event: LogForwardedPayoutRequestDeclined
): void {}

export function handleLogForwardedPayoutRequestProcessed(
  event: LogForwardedPayoutRequestProcessed
): void {}

export function handleLogGovernance(event: LogGovernance): void {}

export function handleLogLiquidation(event: LogLiquidation): void {}

export function handleLogMarketIncentiveFeeUpdated(
  event: LogMarketIncentiveFeeUpdated
): void {}

export function handleLogMarketPolicyBuyerAllowlistIdChanged(
  event: LogMarketPolicyBuyerAllowlistIdChanged
): void {}

export function handleLogMarketStatusChanged(
  event: LogMarketStatusChanged
): void {}

export function handleLogNewDistributor(event: LogNewDistributor): void {}

export function handleLogNewForwardedPayoutRequest(
  event: LogNewForwardedPayoutRequest
): void {}

export function handleLogNewLevel(event: LogNewLevel): void {}

export function handleLogNewMarketCreated(event: LogNewMarketCreated): void {}

export function handleLogNewMarketStatus(event: LogNewMarketStatus): void {}

export function handleLogNewPayoutRequest(event: LogNewPayoutRequest): void {}

export function handleLogNewPool(event: LogNewPool): void {}

export function handleLogNewProduct(event: LogNewProduct): void {}

export function handleLogNewProductStatus(event: LogNewProductStatus): void {}

export function handleLogNewSystemStatus(event: LogNewSystemStatus): void {}

export function handleLogNextLevelAdded(event: LogNextLevelAdded): void {}

export function handleLogNextLevelRemoved(event: LogNextLevelRemoved): void {}

export function handleLogPayout(event: LogPayout): void {}

export function handleLogPermissionTokenIssued(
  event: LogPermissionTokenIssued
): void {}

export function handleLogPermissionTokenRevoked(
  event: LogPermissionTokenRevoked
): void {}

export function handleLogPolicyCoverChanged(
  event: LogPolicyCoverChanged
): void {}

export function handleLogPolicyDeposit(event: LogPolicyDeposit): void {}

export function handleLogPolicyWithdraw(event: LogPolicyWithdraw): void {}

export function handleLogPoolAddedToMarket(event: LogPoolAddedToMarket): void {}

export function handleLogPremiumEarned(event: LogPremiumEarned): void {}

export function handleLogRiskPoolAddedToLevel(
  event: LogRiskPoolAddedToLevel
): void {}

export function handleLogRiskPoolRemovedFromLevel(
  event: LogRiskPoolRemovedFromLevel
): void {}

export function handleLogSwap(event: LogSwap): void {}

export function handleLogWithdrawFee(event: LogWithdrawFee): void {}
