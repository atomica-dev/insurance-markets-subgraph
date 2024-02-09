export enum GovernanceLogType {
  // General
  NewOperator,
  ExecutionDelay,
  NewAllowanceManager,
  Treasury,
  ProductCreatorsAllowlistId,
  ExchangeRateOracle,
  CoverAdjusterOracle,
  SyncOracle,
  ExternalProduct,
  LiquidationGasUsage,
  SolvencyMultiplier,
  MinPolicyDepositMultiplier,
  MaxRiskPoolOperatorFee,

  // RiskPools
  RiskPoolPremiumRateModel,
  RiskPoolMarketCapacityAllowance,
  RiskPoolMcr,
  RiskPoolCap,
  RiskPoolWithdrawDelay,
  RiskPoolWithdrawRequestExpiration,
  RiskPoolLpAllowlistId,
  RiskPoolWithdrawProcedure,
  RiskPoolReserveRatio,
  RiskPoolDetails,
  RiskPoolData,

  // Product
  ProductOperator,
  MarketOperator,
  ProductWording,
  ProductDetails,
  ProductData,
  MarketExchangeRateOracle,
  MarketPolicyBuyerAllowlistId,
  MarketPolicyBuyerAllowancelistId,
  MarketOwner,
  ProductOwner,

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
  RiskPoolLpAllowanceListId,
}
