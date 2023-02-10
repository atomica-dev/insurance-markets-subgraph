export enum GovernanceLogType {
  // General
  NewOperator,
  ExecutionDelay,
  NewAllowanceManager,
  Treasury,
  DefaultPayoutRequester,
  DefaultPayoutApprover,
  ProductCreatorsAllowlistId,
  ExchangeRateOracle,
  CoverAdjusterOracle,
  SyncOracle,
  ExternalProduct,
  LiquidationGasUsage,
  SolvencyMultiplier,
  MinPolicyDepositMultiplier,
  MaxRiskPoolManagerFee,

  // RiskPools
  RiskPoolPremiumRateModel,
  RiskPoolMarketCapacityAllowance,
  RiskPoolMcr,
  RiskPoolCap,
  RiskPoolWithdrawDelay,
  RiskPoolWithdrawRequestExpiration,
  RiskPoolLpAllowlistId,

  // Product
  ProductOperator,
  MarketOperator,
  ProductWording,
  MarketExchangeRateOracle,
  MarketPolicyBuyerAllowlistId,
  MarketPolicyBuyerAllowancelistId,

  // Fees
  ProductOperatorIncentiveFee,
  ProductMaxMarketIncentiveFee,
  MarketOperatorIncentiveFee,
  MaxProductOperatorIncentiveFee,
  MaxMarketOperatorIncentiveFee,
  GovernanceIncentiveFee,
  LiquidationIncentive,
  FrontendOperatorPenalty,
  MarketFeeRecipient,

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
  ExternalRiskPoolsConfidenceInterval,

  SwapCycle,
  SettlementDiscount,
}
