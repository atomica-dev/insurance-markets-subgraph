import { Event, State } from "../generated/schema";
import { ethereum, BigInt } from "@graphprotocol/graph-ts";

export enum EventType {
  TotalMarkets,
  TotalPolicies,
  TotalPoolParticipants,
  PoolBalance,
  ParticipantBalance,
  NewPolicy,
  NewMarket,
  MarketEarnedPremium,
  MarketExposure,
  MarketCapacity,
  NewClaim,
  ClaimStatusChanged,
  MarketLastChargeTotal,
  PolicyTransferred,
  PoolExposure,
  SystemPoolBalance,
  SystemExposure,
  SystemPremiumEarned,
  SystemPoolCount,
  SystemStatus,
  SystemProductCount,
  SystemDesiredCoverage,
  PoolEarnedPremium,
  PoolExternalBalance,
  ExternalPoolConnectionChanged,
  SwapCount,
  PayoutCount,
  PoolReceivedSettlement,
  PoolMarketCount,
  PoolReBalance,
  MarketPolicyPremium,
  MarketQuote,
  MarketActualCover,
}

function getEventTypeString(eventType: EventType): string {
  switch (eventType) {
    case EventType.TotalMarkets:
      return "TotalMarkets";
    case EventType.TotalPolicies:
      return "TotalPolicies";
    case EventType.TotalPoolParticipants:
      return "TotalPoolParticipants";
    case EventType.PoolBalance:
      return "PoolBalance";
    case EventType.NewPolicy:
      return "NewPolicy";
    case EventType.NewMarket:
      return "NewMarket";
    case EventType.ParticipantBalance:
      return "ParticipantBalance";
    case EventType.MarketEarnedPremium:
      return "MarketEarnedPremium";
    case EventType.MarketExposure:
      return "MarketExposure";
    case EventType.MarketCapacity:
      return "MarketCapacity";
    case EventType.NewClaim:
      return "NewClaim";
    case EventType.ClaimStatusChanged:
      return "ClaimStatusChanged";
    case EventType.MarketLastChargeTotal:
      return "MarketLastChargeTotal";
    case EventType.PolicyTransferred:
      return "PolicyTransferred";
    case EventType.PoolExposure:
      return "PoolExposure";
    case EventType.SystemPoolBalance:
      return "SystemPoolBalance";
    case EventType.SystemExposure:
      return "SystemExposure";
    case EventType.SystemPremiumEarned:
      return "SystemPremiumEarned";
    case EventType.SystemPoolCount:
      return "SystemPoolCount";
    case EventType.SystemStatus:
      return "SystemStatus";
    case EventType.SystemProductCount:
      return "SystemProductCount";
    case EventType.SystemDesiredCoverage:
      return "SystemDesiredCoverage";
    case EventType.PoolEarnedPremium:
      return "PoolEarnedPremium";
    case EventType.PoolExternalBalance:
      return "PoolExternalBalance";
    case EventType.ExternalPoolConnectionChanged:
      return "ExternalPoolConnectionChanged";
    case EventType.SwapCount:
      return "SwapCount";
    case EventType.PayoutCount:
      return "PayoutCount";
    case EventType.PoolReceivedSettlement:
      return "PoolReceivedSettlement";
    case EventType.PoolMarketCount:
      return "PoolMarketCount";
    case EventType.PoolReBalance:
      return "PoolReBalance";
    case EventType.MarketPolicyPremium:
      return "MarketPolicyPremium";
    case EventType.MarketQuote:
      return "MarketQuote";
    case EventType.MarketActualCover:
      return "MarketActualCover";
  }

  return eventType.toString();
}

export function getState(
  type: EventType,
  marketId: string = "",
  key: string = ""
): State {
  let id = getEventTypeString(type) + "-" + marketId + "-" + key;
  let state = State.load(id);

  if (state === null) {
    state = new State(id);

    state.type = getEventTypeString(type);
    state.market = marketId;
    state.key = key;
    state.value = BigInt.fromI32(0);
  }

  return state;
}

export function updateState(
  type: EventType,
  delta: BigInt,
  marketId: string|null,
  key: string = "",
  newValue: BigInt|null = null
): BigInt {
  let m: string = marketId ? marketId : "";
  let state = getState(type, m, key);

  if (newValue !== null) {
    state.value = newValue;
  } else {
    state.value = state.value.plus(delta);
  }

  state.save();

  return state.value;
}

export function updateAndLogState(
  type: EventType,
  event: ethereum.Event,
  delta: BigInt,
  marketId: string|null,
  key: string = "",
  newValue: BigInt|null = null
): void {
  addEvent(
    type,
    event,
    marketId,
    key,
    updateState(type, delta, marketId, key, newValue).toString(),
    delta.toString()
  );
}

export function addEvent(
  type: EventType,
  event: ethereum.Event,
  marketId: string|null,
  key: string,
  value1: string|null = null,
  value2: string|null = null,
  value3: string|null = null,
  value4: string|null = null,
  value5: string|null = null
): void {
  let m: string = marketId ? marketId : "";

  let e = new Event(
    getEventTypeString(type) +
      event.transaction.hash.toHexString() +
      event.transaction.index.toString() +
      "-" +
      m +
      "-" +
      key
  );

  e.market = marketId;
  e.key = key;
  e.timestamp = event.block.timestamp;
  e.type = getEventTypeString(type);
  e.value1 = value1;
  e.value2 = value2;
  e.value3 = value3;
  e.value4 = value4;
  e.value5 = value5;

  e.from = event.transaction.from.toHexString();
  e.transaction = event.transaction.hash;
  e.blockNumber = event.block.number;
  e.gasPrice = event.transaction.gasPrice;
  e.gasLimit = event.transaction.gasLimit;

  e.save();
}

export enum StatusEnum {
  Opened,
  Closed,
  Withdraw,
  WithdrawLP,
  WithdrawPolicy,
}

export function updateSystemStatus(newStatus: StatusEnum): void {
  updateState(
    EventType.SystemStatus,
    BigInt.fromI32(0),
    "",
    "",
    BigInt.fromI32(newStatus)
  );
}
