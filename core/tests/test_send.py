import boa
import pytest
from boa.test.strategies import strategy as boa_strategy
from hypothesis import HealthCheck, assume, given, settings

from tests.conftest import ZERO_ADDRESS

NON_ZERO_ADDRESS = boa_strategy("address").filter(lambda addr: int(str(addr), 16) != 0)
POSITIVE_AMOUNT = boa_strategy("uint256", min_value=1, max_value=10**24)


def _same(left, right) -> bool:
    return str(left).lower() == str(right).lower()


def _fund(token, sender, send_contract, amount: int) -> None:
    with boa.env.prank(sender):
        token.mint(sender, amount)
        token.approve(send_contract.address, amount)


# Deployment / initial state


def test_deploy_max_send_length_is_128(send_contract):
    assert send_contract.MAX_SEND_LENGTH() == 128


# Happy path


def test_sandia_send_one_recipient_succeeds(send_contract, token, sender, alice):
    # Arrange
    amount = 100
    _fund(token, sender, send_contract, amount)

    # Act
    with boa.env.prank(sender):
        paid = send_contract.sandia_send([(alice, amount)], token.address)

    # Assert
    assert paid == 1
    assert token.balanceOf(sender) == 0
    assert token.balanceOf(alice) == amount
    assert token.allowance(sender, send_contract.address) == 0


@pytest.mark.gas_profile
def test_sandia_send_several_recipients_succeeds(send_contract, token, sender, alice, bob):
    # Arrange
    first = 40
    second = 60
    _fund(token, sender, send_contract, first + second)

    # Act
    with boa.env.prank(sender):
        paid = send_contract.sandia_send(
            [(alice, first), (bob, second)],
            token.address,
        )

    # Assert
    assert paid == 2
    assert token.balanceOf(sender) == 0
    assert token.balanceOf(alice) == first
    assert token.balanceOf(bob) == second
    assert token.allowance(sender, send_contract.address) == 0


def test_sandia_send_duplicate_recipient_pays_twice(send_contract, token, sender, alice):
    # Arrange
    amount = 10
    _fund(token, sender, send_contract, amount * 2)

    # Act
    with boa.env.prank(sender):
        paid = send_contract.sandia_send(
            [(alice, amount), (alice, amount)],
            token.address,
        )

    # Assert
    assert paid == 2
    assert token.balanceOf(alice) == amount * 2
    assert token.balanceOf(sender) == 0


# Caller scope


def test_sandia_send_third_party_does_not_spend_sender(
    send_contract, token, sender, alice, bob
):
    # Arrange
    amount = 50
    _fund(token, sender, send_contract, amount)
    with boa.env.prank(bob):
        token.mint(bob, amount)

    # Act
    with boa.env.prank(bob):
        with boa.reverts(dev="insufficient allowance"):
            send_contract.sandia_send([(alice, amount)], token.address)

    # Assert
    assert token.balanceOf(sender) == amount
    assert token.allowance(sender, send_contract.address) == amount
    assert token.balanceOf(alice) == 0


# Reverts


def test_sandia_send_empty_batch_reverts(send_contract, token, sender):
    with boa.env.prank(sender):
        with boa.reverts(dev="send has empty batch"):
            send_contract.sandia_send([], token.address)


def test_sandia_send_zero_currency_reverts(send_contract, sender, alice):
    with boa.env.prank(sender):
        with boa.reverts(dev="send currency is zero address"):
            send_contract.sandia_send([(alice, 1)], ZERO_ADDRESS)


def test_sandia_send_zero_recipient_reverts(send_contract, token, sender):
    with boa.env.prank(sender):
        with boa.reverts(dev="send recipient is zero address"):
            send_contract.sandia_send([(ZERO_ADDRESS, 1)], token.address)


def test_sandia_send_zero_amount_reverts(send_contract, token, sender, alice):
    with boa.env.prank(sender):
        with boa.reverts(dev="send amount is zero"):
            send_contract.sandia_send([(alice, 0)], token.address)


def test_sandia_send_false_transfer_reverts(send_contract, false_token, sender, alice):
    with boa.env.prank(sender):
        with boa.reverts(dev="send transfer failed"):
            send_contract.sandia_send([(alice, 1)], false_token.address)


def test_sandia_send_insufficient_allowance_reverts(send_contract, token, sender, alice):
    with boa.env.prank(sender):
        token.mint(sender, 10)
        with boa.reverts(dev="insufficient allowance"):
            send_contract.sandia_send([(alice, 10)], token.address)


def test_sandia_send_insufficient_balance_reverts(send_contract, token, sender, alice):
    with boa.env.prank(sender):
        token.approve(send_contract.address, 10)
        with boa.reverts(dev="insufficient balance"):
            send_contract.sandia_send([(alice, 10)], token.address)


def test_sandia_send_reentrant_callback_reverts(
    send_contract, reentrant_token, sender, alice
):
    # The lock reverts inside the callback. Vyper 0.4.3 reports that
    # check as a uint160 bounds check, then the outer extcall fails.
    with boa.env.prank(sender):
        with pytest.raises(boa.BoaError) as exc_info:
            send_contract.sandia_send([(alice, 1)], reentrant_token.address)
    message = str(exc_info.value)
    assert "uint160 bounds check" in message
    assert "external call failed" in message


# Boundary and fuzzing


def test_sandia_send_max_recipients_succeeds(send_contract, token, sender):
    # Arrange
    count = send_contract.MAX_SEND_LENGTH()
    amount = 1
    recipients = [(boa.env.generate_address(), amount) for _ in range(count)]
    _fund(token, sender, send_contract, count * amount)

    # Act
    with boa.env.prank(sender):
        paid = send_contract.sandia_send(recipients, token.address)

    # Assert
    assert paid == count
    assert token.balanceOf(sender) == 0


def test_sandia_send_over_max_recipients_reverts(send_contract, token, alice):
    bound = send_contract.MAX_SEND_LENGTH()
    recipients = [(alice, 1)] * (bound + 1)
    with boa.reverts(compiler=f"DynArray[Recipient, {bound}] bounds check"):
        send_contract.sandia_send(recipients, token.address)


@given(
    recipient_a=NON_ZERO_ADDRESS,
    recipient_b=NON_ZERO_ADDRESS,
    amount_a=POSITIVE_AMOUNT,
    amount_b=POSITIVE_AMOUNT,
)
@settings(
    max_examples=50,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
)
def test_sandia_send_any_amounts_balance_drops_by_sum(
    send_contract,
    token,
    sender,
    recipient_a,
    recipient_b,
    amount_a,
    amount_b,
):
    assume(not _same(recipient_a, sender))
    assume(not _same(recipient_b, sender))
    total = amount_a + amount_b
    with boa.env.anchor():
        _fund(token, sender, send_contract, total)
        before = token.balanceOf(sender)
        with boa.env.prank(sender):
            send_contract.sandia_send(
                [(recipient_a, amount_a), (recipient_b, amount_b)],
                token.address,
            )
        assert before - token.balanceOf(sender) == total
        if _same(recipient_a, recipient_b):
            assert token.balanceOf(recipient_a) == total
        else:
            assert token.balanceOf(recipient_a) == amount_a
            assert token.balanceOf(recipient_b) == amount_b
