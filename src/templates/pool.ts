import {
  Transfer,
  LogDeposit,
  LogWithdraw,
  Pool as PoolContract,
  LogCoverChanged,
  LogCapacityChanged,
  LogNewRewardDistribution,
  LogAddRewardAmount,
  LogWithdrawRequestCreated,
  LogWithdrawRequestCancelled,
  LogWithdrawRequestProcessed,
  LogMcrUpdated,
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
  LogPullFromReserveWallet,
  LogCommitLoss,
  LogForwardCommitLoss,
  LogContributePremium,
  LogContributeSettlement,
  LogForwardPayoutRequest,
  LogRequestCapital,
} from "../../generated/templates/Pool/Pool";
import {
  Pool,
  PoolMarketRelation,
  PoolParticipant,
  Reward,
  WithdrawRequest,
  PoolPremium,
  PoolSettlement,
  PoolFee,
  ExternalPool,
  OutgoingPayoutRequest,
  OutgoingLoss,
  IncomingLoss,
  PoolOwnLoss,
} from "../../generated/schema";
import { Address, BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import { EventType, addEvent, updateAndLogState, updateState } from "../event";
import { marketPremiumEarned } from "../risk-pools-controller";
import { filterNotEqual } from "../product";
import { getPoolBucket, getRiskPoolConnection } from "../contract-mapper";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function handleTransfer(event: Transfer): void {
  let pool = Pool.load(event.address.toHexString())!;

  if (
    event.params.to.toHexString() == ZERO_ADDRESS ||
    event.params.from.toHexString() == ZERO_ADDRESS
  ) {
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

  updateEarnings(
    pool,
    sender,
    event.block,
    event.params.value.times(BigInt.fromI32(-1))
  );
  updateEarnings(pool, receiver, event.block, event.params.value);

  sender.tokenBalance = sender.tokenBalance.minus(event.params.value);

  if (sender.tokenBalance.isZero()) {
    pool.participants = pool.participants.minus(BigInt.fromI32(1));

    addEvent(
      EventType.TotalPoolParticipants,
      event,
      pool.market,
      pool.id,
      pool.participants.toString()
    );
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

  pool.poolTokenBalance = pool.poolTokenBalance.plus(
    event.params.poolTokenAmount
  );

  if (account === null) {
    account = addPoolParticipant(pool, event.params.usr.toHexString(), event);
  }

  updateEarnings(pool, account, event.block, event.params.poolTokenAmount);

  account.tokenBalance = account.tokenBalance.plus(
    event.params.poolTokenAmount
  );
  account.depositSum = account.depositSum.plus(event.params.capitalTokenAmount);

  pool.save();
  account.save();

  addEvent(
    EventType.ParticipantBalance,
    event,
    pool.market,
    account.id,
    account.tokenBalance.toString(),
    account.user,
    account.poolId,
    event.params.capitalTokenAmount.toString()
  );

  addEvent(
    EventType.PoolBalance,
    event,
    null,
    pool.id,
    pool.poolTokenBalance.toString(),
    pool.capitalTokenBalance.toString(),
    pool.capitalTokenBalance.minus(oldBalance).toString()
  );

  updateState(
    EventType.SystemPoolBalance,
    event.params.capitalTokenAmount,
    null,
    pool.capitalTokenAddress.toHexString()
  );
}

export function handleLogWithdraw(event: LogWithdraw): void {
  let pool = Pool.load(event.address.toHexString())!;
  let account = PoolParticipant.load(pool.id + event.params.usr.toHexString());
  let oldBalance = pool.capitalTokenBalance;

  pool.poolTokenBalance = pool.poolTokenBalance.minus(
    event.params.poolTokenAmount
  );

  pool.save();

  if (account != null) {
    updateEarnings(
      pool,
      account,
      event.block,
      event.params.poolTokenAmount.times(BigInt.fromI32(-1))
    );

    account.tokenBalance = account.tokenBalance.minus(
      event.params.poolTokenAmount
    );
    account.withdrawSum = account.withdrawSum.plus(
      event.params.capitalTokenAmount
    );

    if (account.tokenBalance.isZero()) {
      pool.participants = pool.participants.minus(BigInt.fromI32(1));

      addEvent(
        EventType.TotalPoolParticipants,
        event,
        pool.market,
        pool.id,
        pool.participants.toString()
      );
    }

    account.save();

    addEvent(
      EventType.ParticipantBalance,
      event,
      pool.market,
      account.id,
      account.tokenBalance.toString(),
      account.user,
      account.poolId,
      event.params.capitalTokenAmount.neg().toString()
    );

    addEvent(
      EventType.PoolBalance,
      event,
      null,
      pool.id,
      pool.poolTokenBalance.toString(),
      pool.capitalTokenBalance.toString(),
      pool.capitalTokenBalance.minus(oldBalance).toString()
    );
  }

  updateState(
    EventType.SystemPoolBalance,
    event.params.capitalTokenAmount.neg(),
    null,
    pool.capitalTokenAddress.toHexString()
  );
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

  let pf = PoolFee.load(id);

  if (!pf) {
    pf = new PoolFee(id);

    pf.poolId = event.address;
    pf.tokenId = event.params.token;
    pf.pool = pool.id;
    pf.amount = BigInt.fromI32(0);
  }

  let pContract = PoolContract.bind(event.address);

  pf.amount = getPoolBucket(pContract, event.params.token).managerFeeBalance;

  pf.save();

  addEvent(
    EventType.PoolEarnedPremium,
    event,
    pool.market,
    pool.id,
    event.params.amount.toString(),
    event.params.token.toHexString()
  );

  if (pool.market === null) {
    return;
  }

  marketPremiumEarned(
    pool.market!,
    event.params.amount,
    event.params.token,
    event
  );
}

export function handleLogContributeSettlement(
  event: LogContributeSettlement
): void {
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

  addEvent(
    EventType.PoolReceivedSettlement,
    event,
    pool.market,
    pool.id,
    event.params.amount.toString(),
    event.params.token.toHexString()
  );
}

export function handleLogForwardPayoutRequest(
  event: LogForwardPayoutRequest
): void {
  let id = event.params.payoutRequestId.toString() + "-" +
  event.params.forwardChainId.toString() + "-" +
  event.params.forwardRiskPool.toHexString();
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

  updateState(
    EventType.SystemPoolBalance,
    event.params.amount.neg(),
    null,
    pool.capitalTokenAddress.toHexString()
  );
}

function addPoolParticipant(
  pool: Pool,
  userId: string,
  event: ethereum.Event
): PoolParticipant {
  let account = new PoolParticipant(pool.id + userId);

  account.tokenBalance = BigInt.fromI32(0);
  account.poolId = pool.id;
  account.user = userId;
  account.market = pool.market;
  account.depositSum = BigInt.fromI32(0);
  account.withdrawSum = BigInt.fromI32(0);

  pool.participants = pool.participants.plus(BigInt.fromI32(1));

  addEvent(
    EventType.TotalPoolParticipants,
    event,
    pool.market,
    pool.id,
    pool.participants.toString()
  );

  return account;
}

export function handleLogCoverChanged(event: LogCoverChanged): void {
  let pool = Pool.load(event.address.toHexString())!;
  let pContract = PoolContract.bind(event.address);
  let marketId =
    pool.riskPoolsControllerAddress.toHexString() +
    "-" +
    event.params.marketId.toString();
  let id = pool.id + "-" + marketId;
  let marketRelation = PoolMarketRelation.load(id);
  let oldExposure = pool.exposure;

  if (marketRelation != null) {
    marketRelation.poolId = pool.id;
    marketRelation.pool = pool.id;
    marketRelation.exposure = event.params.internalCover;
    marketRelation.rate = !pContract.try_currentPremiumRate().reverted
      ? pContract.currentPremiumRate()
      : BigInt.fromI32(0);

    marketRelation.save();
  }

  let premiumRate = !pContract.try_currentPremiumRate().reverted
    ? pContract.currentPremiumRate()
    : BigInt.fromI32(0);

  pool.premiumRate = premiumRate;
  pool.exposure = event.params.totalCover;
  pool.updatedAt = event.block.timestamp;

  pool.save();

  addEvent(
    EventType.PoolPremiumRate,
    event,
    null,
    pool.id,
    premiumRate.toString()
  );
  addEvent(
    EventType.PoolExposure,
    event,
    null,
    pool.id,
    pool.exposure.toString()
  );

  updateState(
    EventType.SystemExposure,
    event.params.totalCover.minus(oldExposure),
    null,
    pool.capitalTokenAddress.toHexString()
  );
}

export function handleLogConnectedRiskPoolsDataUpdated(
  event: LogConnectedRiskPoolsDataUpdated
): void {
  let pool = Pool.load(event.address.toHexString())!;
  let pContract = PoolContract.bind(event.address);

  pool.externalStatLastUpdated =
    pool.externalCapacity != event.params.capacity ||
    pool.externalCoverage != event.params.cover
      ? event.block.timestamp
      : pool.externalStatLastUpdated;

  pool.externalCapacity = event.params.capacity;
  pool.externalCoverage = event.params.cover;
  pool.capacity = pContract.capacity();
  pool.exposure = pContract.totalCover();
  pool.poolTokenBalance = pContract.totalSupply();

  pool.save();

  addEvent(
    EventType.PoolExternalBalance,
    event,
    pool.market,
    pool.id,
    event.params.capacity.toString(),
    event.params.cover.toString()
  );
}

export function handleLogSettlementDistributionUpdated(
  event: LogSettlementDistributionUpdated
): void {
  let pool = Pool.load(event.address.toHexString())!;
  let pContract = PoolContract.bind(event.address);

  pool.settlementRootHashLastUpdated =
    pool.settlementRootHash != event.params.rootHash.toHexString()
      ? event.block.timestamp
      : pool.settlementRootHashLastUpdated;

  pool.settlementRootHash = event.params.rootHash.toHexString();
  pool.settlementDataUrl = pContract.settlementDistributionUri();

  pool.save();
}

export function handleLogPremiumDistributionUpdated(
  event: LogPremiumDistributionUpdated
): void {
  let pool = Pool.load(event.address.toHexString())!;
  let pContract = PoolContract.bind(event.address);

  pool.premiumRootHashLastUpdated =
    pool.premiumRootHash != event.params.rootHash.toHexString()
      ? event.block.timestamp
      : pool.premiumRootHashLastUpdated;

  pool.premiumRootHash = event.params.rootHash.toHexString();
  pool.premiumDataUrl = pContract.premiumDistributionUri();

  pool.save();
}

export function handleLogRequestRiskPoolSync(
  event: LogRequestRiskPoolSync
): void {
  event.params.riskPool
}

export function addExternalPool(
  poolAddress: Address,
  chainId: BigInt,
  riskPool: Address,
  event: ethereum.Event,
): void {
  let pool = Pool.load(poolAddress.toHexString())!;
  let epId = chainId.toString() + "-" + riskPool.toHexString();
  let l = pool.externalPoolList;

  if (l.indexOf(epId) < 0) {
    l.push(epId);
    pool.externalPoolList = l;

    pool.save();

    addEvent(
      EventType.ExternalPoolConnectionChanged,
      event,
      null,
      pool.id,
      chainId.toString(),
      riskPool.toHexString(),
      "+"
    );
  }
}

export function handleLogCancelRiskPoolSync(
  event: LogCancelRiskPoolSync
): void {
  let pool = Pool.load(event.address.toHexString())!;
  let epId =
    event.params.chainId.toString() +
    "-" +
    event.params.riskPool_.toHexString();

  pool.externalPoolList = filterNotEqual(pool.externalPoolList, epId);

  pool.save();

  addEvent(
    EventType.ExternalPoolConnectionChanged,
    event,
    null,
    pool.id,
    event.params.chainId.toString(),
    event.params.riskPool_.toHexString(),
    "-"
  );
}

export function handleLogAcceptRiskPoolSync(
  event: LogAcceptRiskPoolSync
): void {
  addExternalPool(
    event.address,
    event.params.chainId,
    event.params.riskPool,
    event,
  );

  createOrUpdatePoolWallet(
    event.params.chainId,
    event.params.riskPool,
    event.address
  );
}

export function handleLogAcknowledgeRiskPoolSync(
  event: LogAcknowledgeRiskPoolSync
): void {
  addExternalPool(
    event.address,
    event.params.chainId,
    event.params.riskPool_,
    event,
  );

  createOrUpdatePoolWallet(
    event.params.chainId,
    event.params.riskPool_,
    event.address
  );
}

function createOrUpdatePoolWallet(
  chainId: BigInt,
  poolId: Address,
  poolAddress: Address
): void {
  let pContract = PoolContract.bind(poolAddress);
  let ePoolConfig = getRiskPoolConnection(pContract, chainId, poolId);

  let pool = Pool.load(poolAddress.toHexString())!;

  pool.totalTransferredOut = pContract.totalTransferredToReserves();
  pool.capitalTokenBalance = pContract.stats().value0;

  pool.save();

  let id =
    chainId.toString() +
    "-" +
    poolId.toHexString() +
    "-" +
    ePoolConfig.reserveWallet.toHexString();

  let w = ExternalPool.load(id);

  if (!w) {
    w = new ExternalPool(id);
  }

  w.chainId = chainId;
  w.poolId = poolId;
  w.externalReserveWallet = ePoolConfig.externalReserveWallet;
  w.reserveWallet = ePoolConfig.reserveWallet;
  w.isActive = ePoolConfig.active;
  w.balance = ePoolConfig.transferredToReserve;

  w.save();
}

export function handleLogTransferReserve(event: LogTransferReserve): void {
  createOrUpdatePoolWallet(
    event.params.toChainId,
    event.params.toRiskPool,
    event.address
  );
}

export function handleLogPullFromReserveWallet(
  event: LogPullFromReserveWallet
): void {
  createOrUpdatePoolWallet(
    event.params.forChainId,
    event.params.forRiskPool,
    event.address
  );
}

export function handleLogCommitLoss(event: LogCommitLoss): void {
  let id = event.block.number.toString() + "-" +
    event.params.fromChainId.toString() + "-" +
    event.params.fromRiskPool.toHexString();
  let loss = new IncomingLoss(id);

  loss.poolId = event.address;
  loss.sourceChainId = event.params.fromChainId;
  loss.sourcePoolId = event.params.fromRiskPool;
  loss.amount = event.params.lossAmount;
  loss.createdAt = event.block.timestamp;

  loss.save();

  createOrUpdatePoolWallet(
    event.params.fromChainId,
    event.params.fromRiskPool,
    event.address
  );
}

export function handleLogCapitalReleased(event: LogCapitalReleased): void {
  let id = event.block.number.toString() + "-" +
    event.transactionLogIndex.toString();
  let loss = new PoolOwnLoss(id);

  loss.poolId = event.address;
  loss.amount = event.params.releasedAmount;
  loss.createdAt = event.block.timestamp;

  loss.save();
}

export function handleLogForwardCommitLoss(event: LogForwardCommitLoss): void {
  let id = event.block.number.toString() + "-" +
    event.params.toChainId.toString() + "-" +
    event.params.toRiskPool.toHexString();
  let loss = new OutgoingLoss(id);

  loss.poolId = event.address;
  loss.targetChainId = event.params.toChainId;
  loss.targetPoolId = event.params.toRiskPool;
  loss.amount = event.params.amount;
  loss.createdAt = event.block.timestamp;

  loss.save();

  createOrUpdatePoolWallet(
    event.params.toChainId,
    event.params.toRiskPool,
    event.address
  );
}

export function handleLogCapacityChanged(event: LogCapacityChanged): void {
  let pool = Pool.load(event.address.toHexString())!;
  let pContract = PoolContract.bind(event.address);
  let oldBalance = pool.capitalTokenBalance;
  let oldCapacity = pool.capacity;
  let stats = pContract.stats();

  pool.capitalTokenBalance = stats.value0;
  pool.capacity = event.params.capacity;
  pool.poolTokenBalance = stats.value1;
  pool.updatedAt = event.block.timestamp;

  let premiumRate = !pContract.try_currentPremiumRate().reverted
    ? pContract.currentPremiumRate()
    : pool.premiumRate;

  pool.premiumRate = premiumRate;

  pool.save();

  let markets = pool.markets;

  for (let i = 0; i < markets.length; i++) {
    let marketId = markets[i];
    let id = pool.id + "-" + marketId;
    let pmr = PoolMarketRelation.load(id);

    if (!pmr) {
      continue;
    }

    let premiumRate = !pContract.try_currentPremiumRate().reverted
      ? pContract.currentPremiumRate()
      : BigInt.fromI32(0);

    pmr.rate = premiumRate;

    pmr.save();

    updateAndLogState(
      EventType.MarketCapacity,
      event,
      event.params.capacity.minus(oldCapacity),
      marketId,
      pool.capitalTokenAddress.toHexString()
    );
  }

  addEvent(
    EventType.PoolPremiumRate,
    event,
    null,
    pool.id,
    premiumRate.toString()
  );

  if (!pool.capitalTokenBalance.minus(oldBalance).isZero()) {
    addEvent(
      EventType.PoolBalance,
      event,
      null,
      pool.id,
      pool.poolTokenBalance.toString(),
      pool.capitalTokenBalance.toString(),
      pool.capitalTokenBalance.minus(oldBalance).toString()
    );
  }
}

function updateEarnings(
  pool: Pool,
  account: PoolParticipant,
  block: ethereum.Block,
  newTokenDepositDelta: BigInt
): void {
  let from = account.earnedFrom;
  let newDepositDelta = newTokenDepositDelta
    .times(pool.capitalTokenBalance)
    .div(pool.poolTokenBalance);

  if (from === null) {
    account.earnedSum = BigInt.fromI32(0);
    account.dpSum = BigInt.fromI32(0);
    account.lastDeposit = newDepositDelta;
  } else {
    let currentBalance = account.tokenBalance
      .times(pool.capitalTokenBalance)
      .div(pool.poolTokenBalance);
    let earned = currentBalance.minus(account.lastDeposit!);
    let period = block.timestamp.minus(from);

    account.earnedSum = account.earnedSum!.plus(earned);
    account.dpSum = account.dpSum!.plus(account.lastDeposit!.times(period));
    account.lastDeposit = currentBalance.plus(newDepositDelta);
  }

  account.earnedFrom = block.timestamp;
}

export function handleLogNewRewardDistribution(
  event: LogNewRewardDistribution
): void {
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
  reward.rewardTokenDecimals = !rContract.try_decimals().reverted
    ? rContract.try_decimals().value
    : 18;
  reward.rewardTokenSymbol = !rContract.try_symbol().reverted
    ? rContract.try_symbol().value
    : "";
  reward.rewardTokenName = !rContract.try_name().reverted
    ? rContract.try_name().value
    : "";
  reward.startedAt = cReward.value2;
  reward.endedAt = cReward.value3;
  reward.ratePerSecond = cReward.value4;
  reward.updatedAt = cReward.value5;
  reward.rewardPerToken = cReward.value6;
  reward.cid = cReward.value7;

  reward.save();

  let pool = Pool.load(event.address.toHexString())!;

  let r = pool.rewards;

  r.push(id);

  pool.rewards = r;

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

export function handleLogWithdrawRequestCreated(
  event: LogWithdrawRequestCreated
): void {
  let id =
    event.params.applicant.toHexString() +
    "-" +
    event.address.toHexString() +
    "-" +
    event.params.id.toString();
  let request = new WithdrawRequest(id);

  request.num = event.params.id;
  request.poolId = event.address;
  request.userId = event.params.applicant;
  request.status = WithdrawRequestStatus.Created;
  request.amount = event.params.poolTokenAmount;
  request.delayedAt = event.params.delayedAt;

  request.save();
}

export function handleLogWithdrawRequestCancelled(
  event: LogWithdrawRequestCancelled
): void {
  let id =
    event.params.applicant.toHexString() +
    "-" +
    event.address.toHexString() +
    "-" +
    event.params.id.toString();
  let request = WithdrawRequest.load(id)!;

  request.status = WithdrawRequestStatus.Cancelled;

  request.save();
}

export function handleLogWithdrawRequestProcessed(
  event: LogWithdrawRequestProcessed
): void {
  let id =
    event.params.applicant.toHexString() +
    "-" +
    event.address.toHexString() +
    "-" +
    event.params.id.toString();
  let request = WithdrawRequest.load(id)!;

  request.status = WithdrawRequestStatus.Withdrawn;

  request.save();
}

export function handleLogMcrUpdated(event: LogMcrUpdated): void {
  let pool = Pool.load(event.address.toHexString())!;

  pool.mcr = event.params.mcr;

  pool.save();
}

export function handleLogWithdrawDelayUpdated(
  event: LogWithdrawDelayUpdated
): void {
  let pool = Pool.load(event.address.toHexString())!;

  pool.withdrawDelay = event.params.withdrawDelay;

  pool.save();
}

export function handleLogWithdrawRequestExpirationUpdated(
  event: LogWithdrawRequestExpirationUpdated
): void {
  let pool = Pool.load(event.address.toHexString())!;

  pool.withdrawRequestExpiration = event.params.withdrawRequestExpiration;

  pool.save();
}
