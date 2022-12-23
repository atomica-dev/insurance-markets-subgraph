import { AdjustmentConfiguration, Product } from "../generated/schema";
import {
  CoverAdjuster as CoverAdjusterContract,
  LogConfigurationCreated,
  LogConfigurationRemoved,
  LogConfigurationUpdated,
  LogPolicyAdjusted,
} from "../generated/templates/CoverAdjuster/CoverAdjuster";
import { log, store } from "@graphprotocol/graph-ts";

export function handleLogConfigurationCreated(
  event: LogConfigurationCreated
): void {
  let contract = CoverAdjusterContract.bind(event.address);
  let id = event.address.toHexString() + "-" + event.params.id.toString();
  let ac = new AdjustmentConfiguration(id);
  let cc = contract.getConfig(event.params.id);
  let product = Product.load(cc.productId.toString());
  let pti =
    product != null ? product.policyTokenIssuerAddress.toHexString() : "";

  ac.configId = event.params.id;
  ac.coverAdjuster = event.address;
  ac.productId = cc.productId;
  ac.product = cc.productId.toString();
  ac.policyId = cc.policyId;
  ac.policy = pti + "-" + cc.policyId.toString();
  ac.tokenId = cc.permissionId;
  ac.maxCoverage = cc.maxCover;
  ac.maxRate = cc.maxRate;
  ac.adjustmentFrequency = contract.adjustmentFrequency();

  ac.save();
}

export function handleLogConfigurationRemoved(
  event: LogConfigurationRemoved
): void {
  let id = event.address.toHexString() + "-" + event.params.id.toString();

  store.remove("AdjustmentConfiguration", id);
}

export function handleLogConfigurationUpdated(
  event: LogConfigurationUpdated
): void {
  let id = event.address.toHexString() + "-" + event.params.id.toString();
  let ac = AdjustmentConfiguration.load(id)!;
  let contract = CoverAdjusterContract.bind(event.address);
  let cc = contract.getConfig(event.params.id);

  ac.maxCoverage = cc.maxCover;
  ac.maxRate = cc.maxRate;
  ac.adjustmentFrequency = contract.adjustmentFrequency();

  ac.save();
}

export function handleLogPolicyAdjusted(event: LogPolicyAdjusted): void {
  let id = event.address.toHexString() + "-" + event.params.id.toString();
  let ac = new AdjustmentConfiguration(id);

  ac.lastAdjustmentAt = event.block.timestamp;

  ac.save();
}
