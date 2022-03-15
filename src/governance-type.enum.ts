export enum GovernanceLogType {
  // General
  NewOperator,
  Treasury,
  DefaultPayoutRequester,
  DefaultPayoutApprover,
  ProductCreatorsAllowlistId,
  PremiumRateModel,
  ExchangeRateOracle,
  CoverAdjusterOracle,
  SyncOracle,
  ExternalProduct,
  LiquidationGasUsage,
  SolvencyMultiplier,
  MinPolicyDepositMultiplier,

  // RiskPools
  RiskPoolPremiumRateModel,
  RiskPoolMarketCapacityAllowance,
  RiskPoolMcr,
  RiskPoolCapitalRequirement,
  RiskPoolWithdrawDelay,
  RiskPoolWithdrawRequestExpiration,
  RiskPoolLpAllowlistId,

  // Product
  ProductOperator,
  MarketOperator,
  ProductWording,
  MarketExchangeRateOracle,
  MarketPolicyBuyerAllowlistId,

  // Fees
  ProductOperatorIncentiveFee,
  ProductMaxMarketIncentiveFee,
  MarketOperatorIncentiveFee,
  MaxProductOperatorIncentiveFee,
  MaxMarketOperatorIncentiveFee,
  GovernanceIncentiveFee,
  LiquidationIncentive,
  FrontendOperatorPenalty,

  // Market
  MarketCoverAdjusterOracle,

  // Frontend operators
  NewFrontendOperator,
  FrontendOperatorDisabled,
  FrontendOperatorEnabled,
  FrontendOperatorFee,
  ReferralFee,
  PolicyBuyerReferralBonus,

  BridgeConnector,
  ConnectedCapacityDetailsConfidenceInterval,

  SwapCycle,
  SettlementDiscount
}
