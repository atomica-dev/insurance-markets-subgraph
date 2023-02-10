import {
  Transfer,
  LogDeposit,
  LogWithdraw,
  Pool as PoolContract,
  LogCapacityChanged,
  LogNewRewardDistribution,
  LogAddRewardAmount,
  LogWithdrawRequestCreated,
  LogWithdrawRequestCancelled,
  LogWithdrawRequestProcessed,
  LogWithdrawDelayUpdated,
  LogWithdrawRequestExpirationUpdated,
  LogCancelRiskPoolSync,
  LogConnectedRiskPoolsDataUpdated,
  LogCapitalReleased,
  LogPremiumDistributionUpdated,
  LogSettlementDistributionUpdated,
  LogRequestRiskPoolSync,
  LogAcceptRiskPoolSync,
  LogAcknowledgeRiskPoolSync,
  LogTransferReserve,
  LogPullFromRefundWallet,
  LogCommitLoss,
  LogForwardCommitLoss,
  LogContributePremium,
  LogContributeSettlement,
  LogForwardPayoutRequest,
  LogRequestCapital,
} from "../../generated/templates/Pool/Pool";
import {
  Pool,
  PoolParticipant,
  Reward,
  WithdrawRequest,
  PoolPremium,
  PoolSettlement,
  ExternalWallet,
  OutgoingPayoutRequest,
  OutgoingLoss,
  IncomingLoss,
  PoolOwnLoss,
} from "../../generated/schema";
import { Address, BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import { EventType, addEvent, updateState } from "../event";
import { marketPremiumEarned } from "../risk-pools-controller";
import { getRiskPoolConnection } from "../contract-mapper";
import { addToList, filterNotEqual, ZERO_ADDRESS } from "../utils";

export function handleTransfer(event: Transfer): void {
  let pool = Pool.load(event.address.toHexString())!;

  if (event.params.to.toHexString() == ZERO_ADDRESS || event.params.from.toHexString() == ZERO_ADDRESS) {
    return;
  }

  let sender = PoolParticipant.load(pool.id + event.params.from.toHexString());
  let receiver = PoolParticipant.load(pool.id + event.params.to.toHexString());

  if (receiver === null) {
    receiver = addPoolParticipant(pool, event.params.to.toHexString(), event);
  }

  receiver.tokenBalance = receiver.tokenBalance.plus(event.params.value);
  receiver.save();

  if (!sender) {
    return;
  }

  sender.tokenBalance = sender.tokenBalance.minus(event.params.value);

  if (sender.tokenBalance.isZero()) {
    pool.participants = pool.participants.minus(BigInt.fromI32(1));

    addEvent(EventType.TotalPoolParticipants, event, null, pool.id, pool.participants.toString());
  }

  pool.save();
  if (sender.id != null) {
    sender.save();
  }
}

export function handleLogDeposit(event: LogDeposit): void {
  let pool = Pool.load(event.address.toHexString())!;
  let account = PoolParticipant.load(pool.id + event.params.usr.toHexString());
  let oldBalance = pool.capitalTokenBalance;

  pool.poolTokenBalance = pool.poolTokenBalance.plus(event.params.poolTokenAmount);

  if (account === null) {
    account = addPoolParticipant(pool, event.params.usr.toHexString(), event);
  }

  account.tokenBalance = account.tokenBalance.plus(event.params.poolTokenAmount);

  pool.save();
  account.save();

  addEvent(
    EventType.ParticipantBalance,
    event,
    null,
    account.id,
    account.tokenBalance.toString(),
    account.user,
    account.poolId,
    event.params.capitalTokenAmount.toString(),
  );

  addEvent(
    EventType.PoolBalance,
    event,
    null,
    pool.id,
    pool.poolTokenBalance.toString(),
    pool.capitalTokenBalance.toString(),
    pool.capitalTokenBalance.minus(oldBalance).toString(),
  );

  updateState(EventType.SystemPoolBalance, event.params.capitalTokenAmount, null, pool.capitalTokenAddress.toHexString());
}

export function handleLogWithdraw(event: LogWithdraw): void {
  let pool = Pool.load(event.address.toHexString())!;
  let account = PoolParticipant.load(pool.id + event.params.usr.toHexString());
  let oldBalance = pool.capitalTokenBalance;

  pool.poolTokenBalance = pool.poolTokenBalance.minus(event.params.poolTokenAmount);

  pool.save();

  if (account != null) {
    account.tokenBalance = account.tokenBalance.minus(event.params.poolTokenAmount);

    if (account.tokenBalance.isZero()) {
      pool.participants = pool.participants.minus(BigInt.fromI32(1));

      addEvent(EventType.TotalPoolParticipants, event, null, pool.id, pool.participants.toString());
    }

    account.save();

    addEvent(
      EventType.ParticipantBalance,
      event,
      null,
      account.id,
      account.tokenBalance.toString(),
      account.user,
      account.poolId,
      event.params.capitalTokenAmount.neg().toString(),
    );

    addEvent(
      EventType.PoolBalance,
      event,
      null,
      pool.id,
      pool.poolTokenBalance.toString(),
      pool.capitalTokenBalance.toString(),
      pool.capitalTokenBalance.minus(oldBalance).toString(),
    );
  }

  updateState(EventType.SystemPoolBalance, event.params.capitalTokenAmount.neg(), null, pool.capitalTokenAddress.toHexString());
}

export function handleLogContributePremium(event: LogContributePremium): void {
  let pool = Pool.load(event.address.toHexString())!;

  let id = pool.id + "-" + event.params.token.toHexString();
  let pp = PoolPremium.load(id);

  if (!pp) {
    pp = new PoolPremium(id);

    pp.poolId = event.address;
    pp.tokenId = event.params.token;
    pp.pool = pool.id;
    pp.amount = BigInt.fromI32(0);
  }

  pp.amount = pp.amount.plus(event.params.amount);

  pp.save();

  let marketId = pool.riskPoolsControllerAddress.toHexString() + "-" + event.params.marketId.toString();

  addEvent(EventType.PoolEarnedPremium, event, marketId, pool.id, event.params.amount.toString(), event.params.token.toHexString());

  marketPremiumEarned(marketId, event.params.amount, event.params.token, event);
}

export function handleLogContributeSettlement(event: LogContributeSettlement): void {
  let pool = Pool.load(event.address.toHexString())!;

  let id = pool.id + "-" + event.params.token.toHexString();
  let pp = PoolSettlement.load(id);

  if (!pp) {
    pp = new PoolSettlement(id);

    pp.poolId = event.address;
    pp.tokenId = event.params.token;
    pp.pool = pool.id;
    pp.amount = BigInt.fromI32(0);
  }

  pp.amount = pp.amount.plus(event.params.amount);

  pp.save();

  addEvent(EventType.PoolReceivedSettlement, event, null, pool.id, event.params.amount.toString(), event.params.token.toHexString());
}

export function handleLogForwardPayoutRequest(event: LogForwardPayoutRequest): void {
  let id = event.params.payoutRequestId.toString() + "-" + event.params.forwardChainId.toString() + "-" + event.params.forwardRiskPool.toHexString();
  let request = new OutgoingPayoutRequest(id);

  request.poolId = event.address;
  request.payoutRequestId = event.params.payoutRequestId;
  request.payoutRequest = event.params.payoutRequestId.toString();
  request.targetChainId = event.params.forwardChainId;
  request.targetPoolId = event.params.forwardRiskPool;
  request.amount = event.params.amount;
  request.recipient = event.params.recipient;
  request.createdAt = event.block.timestamp;

  request.save();
}

export function handleLogRequestCapital(event: LogRequestCapital): void {
  let pool = Pool.load(event.address.toHexString())!;

  /* Warning!
    Pool balance mustn't be changed here, as it is updated in LogCapacityChanged event.
  */

  updateState(EventType.SystemPoolBalance, event.params.amount.neg(), null, pool.capitalTokenAddress.toHexString());
}

function addPoolParticipant(pool: Pool, userId: string, event: ethereum.Event): PoolParticipant {
  let account = new PoolParticipant(pool.id + userId);

  account.tokenBalance = BigInt.fromI32(0);
  account.poolId = pool.id;
  account.user = userId;

  pool.participants = pool.participants.plus(BigInt.fromI32(1));

  addEvent(EventType.TotalPoolParticipants, event, null, pool.id, pool.participants.toString());

  return account;
}

export function handleLogConnectedRiskPoolsDataUpdated(event: LogConnectedRiskPoolsDataUpdated): void {
  let pool = Pool.load(event.address.toHexString())!;
  let pContract = PoolContract.bind(event.address);

  pool.externalStatLastUpdated = event.block.timestamp;

  pool.externalCapacity = event.params.capacity;
  pool.poolTokenBalance = pContract.totalSupply();

  pool.save();

  addEvent(EventType.PoolExternalBalance, event, null, pool.id, event.params.capacity.toString());
}

export function handleLogSettlementDistributionUpdated(event: LogSettlementDistributionUpdated): void {
  let pool = Pool.load(event.address.toHexString())!;
  let pContract = PoolContract.bind(event.address);

  pool.settlementRootHashLastUpdated =
    pool.settlementRootHash != event.params.rootHash.toHexString() ? event.block.timestamp : pool.settlementRootHashLastUpdated;

  pool.settlementRootHash = event.params.rootHash.toHexString();
  pool.settlementDataUrl = pContract.settlementDistributionUri();

  pool.save();
}

export function handleLogPremiumDistributionUpdated(event: LogPremiumDistributionUpdated): void {
  let pool = Pool.load(event.address.toHexString())!;
  let pContract = PoolContract.bind(event.address);

  pool.premiumRootHashLastUpdated =
    pool.premiumRootHash != event.params.rootHash.toHexString() ? event.block.timestamp : pool.premiumRootHashLastUpdated;

  pool.premiumRootHash = event.params.rootHash.toHexString();
  pool.premiumDataUrl = pContract.premiumDistributionUri();

  pool.save();
}

export function handleLogRequestRiskPoolSync(event: LogRequestRiskPoolSync): void {
  event.params.riskPool;
}

export function addExternalPool(poolAddress: Address, chainId: BigInt, riskPool: Address, event: ethereum.Event): void {
  let pool = Pool.load(poolAddress.toHexString())!;
  let epId = chainId.toString() + "-" + riskPool.toHexString();
  let l = pool.externalPoolList;

  if (l.indexOf(epId) < 0) {
    pool.externalPoolList = addToList(pool.externalPoolList, epId);

    pool.save();

    addEvent(EventType.ExternalPoolConnectionChanged, event, null, pool.id, chainId.toString(), riskPool.toHexString(), "+");
  }
}

export function handleLogCancelRiskPoolSync(event: LogCancelRiskPoolSync): void {
  let pool = Pool.load(event.address.toHexString())!;
  let epId = event.params.chainId.toString() + "-" + event.params.riskPool_.toHexString();

  pool.externalPoolList = filterNotEqual(pool.externalPoolList, epId);

  pool.save();

  addEvent(EventType.ExternalPoolConnectionChanged, event, null, pool.id, event.params.chainId.toString(), event.params.riskPool_.toHexString(), "-");
}

export function handleLogAcceptRiskPoolSync(event: LogAcceptRiskPoolSync): void {
  addExternalPool(event.address, event.params.chainId, event.params.riskPool, event);

  createOrUpdatePoolWallet(event.params.chainId, event.params.riskPool, event.address);
}

export function handleLogAcknowledgeRiskPoolSync(event: LogAcknowledgeRiskPoolSync): void {
  addExternalPool(event.address, event.params.chainId, event.params.riskPool_, event);

  createOrUpdatePoolWallet(event.params.chainId, event.params.riskPool_, event.address);
}

function createOrUpdatePoolWallet(chainId: BigInt, poolId: Address, poolAddress: Address): void {
  let pContract = PoolContract.bind(poolAddress);
  let ePoolConfig = getRiskPoolConnection(pContract, chainId, poolId);

  let pool = Pool.load(poolAddress.toHexString())!;

  pool.totalTransferredOut = pContract.totalTransferredToReserves();
  pool.capitalTokenBalance = pContract.stats().value0;

  pool.save();

  let id = poolAddress.toHexString() + "-" + chainId.toString() + "-" + poolId.toHexString();

  let w = ExternalWallet.load(id);

  if (!w) {
    w = new ExternalWallet(id);

    w.transferredTo = BigInt.fromI32(0);
    w.externalChainId = chainId;
    w.externalPoolId = poolId;
    w.pool = poolAddress.toHexString();
  }

  w.externalReserveWallet = ePoolConfig.externalReserveWallet;
  w.externalRefundWallet = ePoolConfig.externalRefundWallet;
  w.reserveWallet = ePoolConfig.reserveWallet;
  w.refundWallet = ePoolConfig.refundWallet;
  w.isActive = ePoolConfig.active;
  w.transferredTo = ePoolConfig.transferredToReserve;

  w.save();
}

export function handleLogTransferReserve(event: LogTransferReserve): void {
  createOrUpdatePoolWallet(event.params.toChainId, event.params.toRiskPool, event.address);
}

export function handleLogPullFromRefundWallet(event: LogPullFromRefundWallet): void {
  createOrUpdatePoolWallet(event.params.forChainId, event.params.forRiskPool, event.address);
}

export function handleLogCommitLoss(event: LogCommitLoss): void {
  let id = event.block.number.toString() + "-" + event.params.fromChainId.toString() + "-" + event.params.fromRiskPool.toHexString();
  let loss = new IncomingLoss(id);

  loss.poolId = event.address;
  loss.sourceChainId = event.params.fromChainId;
  loss.sourcePoolId = event.params.fromRiskPool;
  loss.amount = event.params.lossAmount;
  loss.createdAt = event.block.timestamp;

  loss.save();

  createOrUpdatePoolWallet(event.params.fromChainId, event.params.fromRiskPool, event.address);
}

export function handleLogCapitalReleased(event: LogCapitalReleased): void {
  let id = event.block.number.toString() + "-" + event.transactionLogIndex.toString();
  let loss = new PoolOwnLoss(id);

  loss.poolId = event.address;
  loss.amount = event.params.releasedAmount;
  loss.createdAt = event.block.timestamp;

  loss.save();
}

export function handleLogForwardCommitLoss(event: LogForwardCommitLoss): void {
  let id = event.block.number.toString() + "-" + event.params.toChainId.toString() + "-" + event.params.toRiskPool.toHexString();
  let loss = new OutgoingLoss(id);

  loss.poolId = event.address;
  loss.targetChainId = event.params.toChainId;
  loss.targetPoolId = event.params.toRiskPool;
  loss.amount = event.params.amount;
  loss.createdAt = event.block.timestamp;

  loss.save();

  createOrUpdatePoolWallet(event.params.toChainId, event.params.toRiskPool, event.address);
}

export function handleLogCapacityChanged(event: LogCapacityChanged): void {
  let pool = Pool.load(event.address.toHexString())!;
  let pContract = PoolContract.bind(event.address);
  let oldBalance = pool.capitalTokenBalance;
  let stats = pContract.stats();

  pool.capitalTokenBalance = stats.value0;
  pool.poolTokenBalance = stats.value1;
  pool.updatedAt = event.block.timestamp;

  pool.save();

  if (!pool.capitalTokenBalance.minus(oldBalance).isZero()) {
    addEvent(
      EventType.PoolBalance,
      event,
      null,
      pool.id,
      pool.poolTokenBalance.toString(),
      pool.capitalTokenBalance.toString(),
      pool.capitalTokenBalance.minus(oldBalance).toString(),
    );
  }
}

export function handleLogNewRewardDistribution(event: LogNewRewardDistribution): void {
  let pContract = PoolContract.bind(event.address);
  let id = event.address.toHexString() + "-" + event.params.rewardId.toString();
  let reward = new Reward(id);
  let cReward = pContract.rewards(event.params.rewardId);
  let rContract = PoolContract.bind(cReward.value1); // Using PoolContract as ERC20

  reward.num = event.params.rewardId;
  reward.poolId = event.address.toHexString();
  reward.amount = event.params.rewardAmount;
  reward.creator = cReward.value0;
  reward.rewardToken = cReward.value1;
  reward.rewardTokenDecimals = !rContract.try_decimals().reverted ? rContract.try_decimals().value : 18;
  reward.rewardTokenSymbol = !rContract.try_symbol().reverted ? rContract.try_symbol().value : "";
  reward.rewardTokenName = !rContract.try_name().reverted ? rContract.try_name().value : "";
  reward.startedAt = cReward.value2;
  reward.endedAt = cReward.value3;
  reward.ratePerSecond = cReward.value4;
  reward.updatedAt = cReward.value5;
  reward.rewardPerToken = cReward.value6;
  reward.cid = cReward.value7;

  reward.save();

  let pool = Pool.load(event.address.toHexString())!;

  pool.rewards = addToList(pool.rewards, id);

  pool.save();
}

export function handleLogAddRewardAmount(event: LogAddRewardAmount): void {
  let id = event.address.toHexString() + "-" + event.params.rewardId.toString();
  let reward = Reward.load(id)!;
  let pContract = PoolContract.bind(event.address);
  let cReward = pContract.rewards(event.params.rewardId);

  reward.amount = reward.amount.plus(event.params.rewardAmount);
  reward.ratePerSecond = cReward.value4;

  reward.save();
}

enum WithdrawRequestStatus {
  Created,
  Cancelled,
  Withdrawn,
}

export function handleLogWithdrawRequestCreated(event: LogWithdrawRequestCreated): void {
  let id = event.params.applicant.toHexString() + "-" + event.address.toHexString() + "-" + event.params.id.toString();
  let request = new WithdrawRequest(id);

  request.num = event.params.id;
  request.poolId = event.address;
  request.userId = event.params.applicant;
  request.status = WithdrawRequestStatus.Created;
  request.amount = event.params.poolTokenAmount;
  request.delayedAt = event.params.delayedAt;

  request.save();
}

export function handleLogWithdrawRequestCancelled(event: LogWithdrawRequestCancelled): void {
  let id = event.params.applicant.toHexString() + "-" + event.address.toHexString() + "-" + event.params.id.toString();
  let request = WithdrawRequest.load(id)!;

  request.status = WithdrawRequestStatus.Cancelled;

  request.save();
}

export function handleLogWithdrawRequestProcessed(event: LogWithdrawRequestProcessed): void {
  let id = event.params.applicant.toHexString() + "-" + event.address.toHexString() + "-" + event.params.id.toString();
  let request = WithdrawRequest.load(id)!;

  request.status = WithdrawRequestStatus.Withdrawn;

  request.save();
}

export function handleLogWithdrawDelayUpdated(event: LogWithdrawDelayUpdated): void {
  let pool = Pool.load(event.address.toHexString())!;

  pool.withdrawDelay = event.params.withdrawDelay;

  pool.save();
}

export function handleLogWithdrawRequestExpirationUpdated(event: LogWithdrawRequestExpirationUpdated): void {
  let pool = Pool.load(event.address.toHexString())!;

  pool.withdrawRequestExpiration = event.params.withdrawRequestExpiration;

  pool.save();
}
