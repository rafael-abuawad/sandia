import boa
import pytest
from script.deploy import deploy

ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

ERC20_SOURCE = """
# pragma version ~=0.4.3

balances: HashMap[address, uint256]
allowances: HashMap[address, HashMap[address, uint256]]


@external
def mint(to: address, amount: uint256):
    self.balances[to] += amount


@external
def approve(spender: address, amount: uint256) -> bool:
    self.allowances[msg.sender][spender] = amount
    return True


@external
def transferFrom(owner: address, to: address, amount: uint256) -> bool:
    assert self.balances[owner] >= amount  # dev: insufficient balance
    assert self.allowances[owner][msg.sender] >= amount  # dev: insufficient allowance
    self.allowances[owner][msg.sender] -= amount
    self.balances[owner] -= amount
    self.balances[to] += amount
    return True


@external
@view
def balanceOf(account: address) -> uint256:
    return self.balances[account]


@external
@view
def allowance(owner: address, spender: address) -> uint256:
    return self.allowances[owner][spender]
"""

FALSE_TOKEN_SOURCE = """
# pragma version ~=0.4.3


@external
def transferFrom(owner: address, to: address, amount: uint256) -> bool:
    return False
"""

REENTRANT_SOURCE = """
# pragma version ~=0.4.3

struct Recipient:
    account: address
    amount: uint256


interface ISend:
    def sandia_send(
        recipients: DynArray[Recipient, 128],
        currency: address,
    ) -> uint256: nonpayable


SEND: immutable(address)


@deploy
@payable
def __init__(target: address):
    SEND = target


@external
def transferFrom(owner: address, to: address, amount: uint256) -> bool:
    extcall ISend(SEND).sandia_send([Recipient(account=to, amount=amount)], self)
    return True
"""


@pytest.fixture(scope="session")
def accounts():
    funded = {}
    for name in ("sender", "alice", "bob", "carol"):
        addr = boa.env.generate_address(alias=name)
        boa.env.set_balance(addr, 10**18)
        funded[name] = addr
    return funded


@pytest.fixture
def sender(accounts):
    return accounts["sender"]


@pytest.fixture
def alice(accounts):
    return accounts["alice"]


@pytest.fixture
def bob(accounts):
    return accounts["bob"]


@pytest.fixture
def carol(accounts):
    return accounts["carol"]


@pytest.fixture
def send_contract():
    return deploy()


@pytest.fixture
def token():
    return boa.loads(ERC20_SOURCE)


@pytest.fixture
def false_token():
    return boa.loads(FALSE_TOKEN_SOURCE)


@pytest.fixture
def reentrant_token(send_contract):
    return boa.loads(REENTRANT_SOURCE, send_contract.address)
