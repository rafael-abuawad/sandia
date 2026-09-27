# pragma version ~=0.4.3
# pragma nonreentrancy on
"""
@title Sandia Send
@custom:contract-name sandia-send
@license GNU Affero General Public License v3.0 only
@notice Pulls an ERC-20 from the caller and pays a batch of recipients.
@dev The caller must approve this contract for the sum of the batch
     before calling. A transfer that returns false reverts.
"""


from ethereum.ercs import IERC20


MAX_SEND_LENGTH: public(constant(uint256)) = 128


struct Recipient:
    account: address
    amount: uint256


@external
def sandia_send(
    recipients: DynArray[Recipient, MAX_SEND_LENGTH],
    currency: IERC20,
) -> uint256:
    """
    @notice Send `currency` from the caller to each recipient.
    @dev Reverts when the batch is empty, a recipient or the currency
         is the zero address, an amount is zero, or `transferFrom`
         returns false.
    @param recipients Accounts and amounts to pay. Length is at most
           `MAX_SEND_LENGTH`.
    @param currency ERC-20 pulled from the caller via `transferFrom`.
    @return The number of recipients paid.
    """
    assert len(recipients) != 0  # dev: send has empty batch
    assert currency.address != empty(address)  # dev: send currency is zero address

    for recipient: Recipient in recipients:
        self._pay(currency, recipient)
    return len(recipients)


@internal
def _pay(currency: IERC20, recipient: Recipient):
    """
    @dev Pull `recipient.amount` of `currency` from the caller.
    @param currency ERC-20 to pull.
    @param recipient Account and amount to pay.
    """
    assert recipient.account != empty(address)  # dev: send recipient is zero address
    assert recipient.amount != 0  # dev: send amount is zero

    success: bool = extcall currency.transferFrom(
        msg.sender,
        recipient.account,
        recipient.amount,
    )
    assert success  # dev: send transfer failed
