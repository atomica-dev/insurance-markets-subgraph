import { System } from "../generated/schema";
import { ethereum, BigInt, Address } from "@graphprotocol/graph-ts";
import { RiskPoolsController as RiskPoolsControllerContract } from "../generated/RiskPoolsController/RiskPoolsController";

export function getSystemConfig(id: string): System {
  let config = System.load(id);

  if (config === null) {
    config = new System(id);

    let contract = RiskPoolsControllerContract.bind(
      Address.fromString(id)
    );

    config.rateOracleList = [];
    config.coverAdjusterOracleList = [];
    config.externalProductList = [];
    config.syncOracleList = [];
    config.governanceFee = contract.governanceIncentiveFee();
    config.status = contract.systemStatus();
    config.operator = contract.operator();
    config.allowanceManager = contract.allowanceManager();
    config.treasury = contract.treasury();
    config.defaultPayoutRequester = contract.defaultPayoutRequester();
    config.productCreatorsAllowlistId = contract.productCreatorsAllowlistId();
    config.defaultPayoutApprover = contract.defaultPayoutApprover();
    config.maxProductOperatorIncentiveFee =
      contract.maxProductOperatorIncentiveFee();
    config.maxMarketOperatorIncentiveFee =
      contract.maxMarketOperatorIncentiveFee();
    config.policyTokenIssuer = contract.policyTokenIssuer();
    config.policyTokenPermissionIssuer = contract.policyTokenPermissionIssuer();
    config.liquidationGasUsage = contract.liquidationGasUsage();
    config.liquidationIncentive = contract.liquidationIncentive();
    config.solvencyMultiplier = contract.solvencyMultiplier();
    config.minPolicyDepositMultiplier = contract.minPolicyDepositMultiplier();
    config.maxRiskPoolManagerFee = contract.maxRiskPoolManagerFee();
    config.bridgeConnector = contract.bridgeConnector();
    config.swapCycleDuration = contract.swapCycleDuration();
    config.swapDuration = contract.swapDuration();
    config.idleDuration = contract.idleDuration();
    config.extPoolDetailsConfidenceInterval =
      contract.externalRiskPoolsConfidenceInterval();
    config.maxIterations = contract.maxIterations();

    config.save();
  }

  return config;
}
