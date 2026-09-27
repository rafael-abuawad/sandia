from src import Send
from moccasin.boa_tools import VyperContract


def deploy() -> VyperContract:
    send: VyperContract = Send.deploy()
    print("Deployed Sandia Send at:", send.address)
    print("Max recipients:", send.MAX_SEND_LENGTH())
    return send


def moccasin_main() -> VyperContract:
    return deploy()
