from src import Send
from moccasin.boa_tools import VyperContract
from moccasin.config import get_active_network
from script.verify import verify_contract


def deploy() -> VyperContract:
    send: VyperContract = Send.deploy()
    print("Deployed Sandia Send at:", send.address)
    print("Max recipients:", send.MAX_SEND_LENGTH())

    active_network = get_active_network()
    if active_network.has_explorer():
        verify_contract(send)
    else:
        print("Skipped verification: this network has no explorer")

    return send


def moccasin_main() -> VyperContract:
    return deploy()
