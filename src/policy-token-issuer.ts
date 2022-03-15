import { Transfer } from "../generated/templates/PolicyTokenIssuer/PolicyTokenIssuer";
import { Policy } from "../generated/schema";
import { addEvent, EventType } from "./event";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function handleTransfer(event: Transfer): void {
  if (
    event.params.to.toHexString() == ZERO_ADDRESS ||
    event.params.from.toHexString() == ZERO_ADDRESS
  ) {
    return;
  }

  let policy = Policy.load(
    event.address.toHexString() + "-" + event.params.tokenId.toString()
  );

  if (!policy) {
    return;
  }

  let prevOwner = policy.owner;

  policy.owner = event.params.to.toHexString();

  policy.save();

  addEvent(
    EventType.PolicyTransferred,
    event,
    policy.market,
    policy.id,
    policy.owner,
    prevOwner
  );
}
