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
  ProductData,
  MarketExchangeRateOracle,
  MarketPolicyBuyerAllowlistId,
  MarketPolicyBuyerAllowancelistId,

  // Fees
  ProductOperatorIncentiveFee,
  ProductOperatorFeeRecipient,
  ProductMaxMarketIncentiveFee,
  MarketOperatorIncentiveFee,
  MaxProductOperatorIncentiveFee,
  MaxMarketOperatorIncentiveFee,
  GovernanceIncentiveFee,
  LiquidationIncentive,
  FrontendOperatorPenalty,
  MarketFeeRecipient,

  // Market
  MarketDetails,
  MarketData,
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
