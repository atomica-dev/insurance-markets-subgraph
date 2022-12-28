import { LogClaimSubmitted } from "../generated/templates/PayoutRequester/PayoutRequester";
import { Claim, Product } from "../generated/schema";
import { Address, dataSource } from "@graphprotocol/graph-ts";

enum ClaimStatus {
  Unknown,
  Submitted,
  Approved,
  Declined,
}

export const RPC_CONTRACT_ADDRESS_CONTEXT_KEY = "rpcContractAddress";

export function handleLogClaimSubmitted(event: LogClaimSubmitted): void {
  let context = dataSource.context();
  let rpcContractAddress = Address.fromString(context.getString(RPC_CONTRACT_ADDRESS_CONTEXT_KEY));

  let productId = `${rpcContractAddress}-${event.params.productId.toString()}`;
  let policyId = event.params.policyId;
  let votingId = event.params.votingId;
  let product = Product.load(productId);

  if (product === null) {
    return;
  }

  let ptiAddress = product.policyTokenIssuerAddress;
  let id = `${ptiAddress.toHexString()}-${policyId.toString()}-${votingId.toString()}`;

  let claim = new Claim(id);

  claim.policyId = policyId;
  claim.votingId = votingId;
  claim.policy = `${ptiAddress.toHexString()}-${policyId.toString()}`;
  claim.product = productId;
  claim.details = event.params.details;
  claim.status = ClaimStatus.Submitted;
  claim.submittedBy = event.transaction.from;
  claim.submittedAt = event.block.timestamp;

  claim.save();
}
