import json
import time

import requests
from src import Send
from moccasin.config import get_active_network

# Sandia Send already deployed on Robinhood Chain.
SANDIA_SEND = "0xb6434C3410326edAD702E9452B8895c9bCDE704c"
PRO_API = "https://api.blockscout.com/v2/api"
CHAIN_ID = 4663


def verify_contract(contract) -> None:
    active_network = get_active_network()
    if not active_network.has_explorer():
        raise RuntimeError("This network has no explorer")

    api_key = active_network.explorer_api_key or ""
    if not api_key or api_key.startswith("$"):
        raise RuntimeError(
            "BLOCKSCOUT_API_KEY is missing. Add a Pro API key from dev.blockscout.com to core/.env."
        )

    bundle = contract.deployer.solc_json
    response = requests.post(
        PRO_API,
        params={
            "chain_id": CHAIN_ID,
            "module": "contract",
            "action": "verify_vyper_contract",
            "apikey": api_key,
        },
        data={
            "addressHash": str(contract.address),
            "name": "Send",
            "compilerVersion": _compiler_version(bundle),
            "contractSourceCode": _contract_source(bundle),
        },
        timeout=60,
    )
    payload = _json_or_text(response)
    if response.status_code != 200 or _status(payload) != "1":
        raise RuntimeError(
            "Blockscout rejected verification "
            f"({response.status_code}): {_redact(payload, api_key)}"
        )

    guid = _result(payload)
    if not isinstance(guid, str) or not guid:
        print("Verified Sandia Send at", contract.address)
        return

    _wait_for_guid(guid, api_key)
    print("Verified Sandia Send at", contract.address)
    print(f"https://robinhoodchain.blockscout.com/address/{contract.address}")


def moccasin_main():
    send = Send.at(SANDIA_SEND)
    print("Verifying existing Sandia Send at", send.address)
    verify_contract(send)
    return send


def _compiler_version(bundle: dict) -> str:
    version = str(bundle.get("compiler_version") or "")
    if not version:
        raise RuntimeError("Could not read the Vyper compiler version")
    if not version.startswith("v"):
        version = f"v{version}"
    return version


def _contract_source(bundle: dict) -> str:
    sources = bundle.get("sources") or {}
    for path, entry in sources.items():
        if not str(path).endswith("Send.vy"):
            continue
        if isinstance(entry, dict) and entry.get("content"):
            return str(entry["content"])
        if isinstance(entry, str) and entry:
            return entry
    raise RuntimeError("Could not read Send.vy from the compiler input")


def _wait_for_guid(guid: str, api_key: str) -> None:
    deadline = time.monotonic() + 120
    while time.monotonic() < deadline:
        response = requests.get(
            PRO_API,
            params={
                "chain_id": CHAIN_ID,
                "module": "contract",
                "action": "checkverifystatus",
                "guid": guid,
                "apikey": api_key,
            },
            timeout=30,
        )
        payload = _json_or_text(response)
        result = str(_result(payload))
        if "Pass" in result:
            return
        if "Fail" in result or "Unknown" in result or _status(payload) == "0":
            raise RuntimeError(f"Blockscout verification failed: {_redact(payload, api_key)}")
        time.sleep(3)
    raise RuntimeError("Timed out waiting for Blockscout verification")


def _json_or_text(response: requests.Response) -> object:
    try:
        return response.json()
    except json.JSONDecodeError:
        return response.text[:500]


def _status(payload: object) -> str:
    if isinstance(payload, dict):
        return str(payload.get("status", ""))
    return ""


def _result(payload: object) -> object:
    if isinstance(payload, dict):
        return payload.get("result", payload.get("message", payload))
    return payload


def _redact(payload: object, api_key: str) -> str:
    text = payload if isinstance(payload, str) else json.dumps(payload)
    if api_key:
        text = text.replace(api_key, "***")
    return text
