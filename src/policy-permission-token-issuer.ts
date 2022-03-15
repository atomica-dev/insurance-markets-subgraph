import {
  Transfer,
} from '../generated/templates/PolicyPermissionTokenIssuer/PolicyPermissionTokenIssuer';
import {
  PolicyPermissionToken,
} from '../generated/schema';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export function handleTransfer(event: Transfer): void {
  if (event.params.to.toHexString() == ZERO_ADDRESS ||
    event.params.from.toHexString() == ZERO_ADDRESS ) {
    return;
  }

  let token = PolicyPermissionToken.load(event.params.tokenId.toString())!;

  token.owner = event.params.to;

  token.save();
}
