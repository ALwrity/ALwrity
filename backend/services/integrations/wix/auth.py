import base64
import hashlib
import os
import secrets
from typing import Any, Dict, Optional, Tuple
from urllib.parse import urlencode

import requests
from loguru import logger
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


DEFAULT_WIX_CONNECT_TIMEOUT = 5.0
DEFAULT_WIX_READ_TIMEOUT = 30.0


class WixAuthService:
    def __init__(self, client_id: Optional[str], redirect_uri: str, base_url: str):
        self.client_id = client_id
        self.redirect_uri = redirect_uri
        self.base_url = base_url

    def _get_request_timeout(self) -> Tuple[float, float]:
        connect_timeout = self._read_timeout_value(
            "WIX_HTTP_CONNECT_TIMEOUT", DEFAULT_WIX_CONNECT_TIMEOUT
        )
        read_timeout = self._read_timeout_value(
            "WIX_HTTP_READ_TIMEOUT", DEFAULT_WIX_READ_TIMEOUT
        )
        return (connect_timeout, read_timeout)

    @staticmethod
    def _read_timeout_value(env_name: str, default_value: float) -> float:
        raw_value = os.getenv(env_name)
        if raw_value is None:
            return default_value
        try:
            value = float(raw_value)
        except (TypeError, ValueError):
            logger.warning(
                f"Invalid {env_name} value {raw_value!r}; using default {default_value}"
            )
            return default_value
        if value <= 0:
            logger.warning(
                f"Invalid {env_name} value {raw_value!r}; must be greater than 0; using default {default_value}"
            )
            return default_value
        return value

    @staticmethod
    def _get_retry_session() -> requests.Session:
        session = requests.Session()
        retry = Retry(
            total=3,
            connect=3,
            read=3,
            status=3,
            status_forcelist=(429, 500, 502, 503, 504),
            allowed_methods=None,
            backoff_factor=1,
            raise_on_status=False,
        )
        adapter = HTTPAdapter(max_retries=retry)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        return session

    def _request_with_retry(self, method: str, url: str, **kwargs: Any) -> requests.Response:
        session = self._get_retry_session()
        try:
            return session.request(method=method, url=url, timeout=self._get_request_timeout(), **kwargs)
        except requests.Timeout as exc:
            logger.exception(f"Wix {method} request timed out: {url}")
            raise requests.Timeout(f"Wix {method} request timed out") from exc

    def generate_authorization_url(self, state: Optional[str] = None) -> Tuple[str, str]:
        if not self.client_id:
            raise ValueError("Wix client ID not configured")
        code_verifier = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode("utf-8").rstrip("=")
        code_challenge = base64.urlsafe_b64encode(
            hashlib.sha256(code_verifier.encode("utf-8")).digest()
        ).decode("utf-8").rstrip("=")
        oauth_url = "https://www.wix.com/oauth/authorize"
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": (
                "BLOG.CREATE-DRAFT,BLOG.PUBLISH-POST,BLOG.READ-CATEGORY,"
                "BLOG.CREATE-CATEGORY,BLOG.READ-TAG,BLOG.CREATE-TAG,"
                "MEDIA.SITE_MEDIA_FILES_IMPORT"
            ),
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }
        if state:
            params["state"] = state
        return f"{oauth_url}?{urlencode(params)}", code_verifier

    def exchange_code_for_tokens(self, code: str, code_verifier: str) -> Dict[str, Any]:
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": self.redirect_uri,
            "client_id": self.client_id,
            "code_verifier": code_verifier,
        }
        token_url = f"{self.base_url}/oauth2/token"
        logger.info(
            f"Wix token exchange: client_id={self.client_id}, redirect_uri={self.redirect_uri}, "
            f"code_verifier_prefix={code_verifier[:10]}..."
        )
        response = self._request_with_retry("POST", token_url, headers=headers, data=data)
        if response.status_code != 200:
            logger.error(f"Wix token exchange failed: {response.status_code} {response.text}")
        response.raise_for_status()
        return response.json()

    def refresh_access_token(self, refresh_token: str) -> Dict[str, Any]:
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        data = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": self.client_id,
        }
        token_url = f"{self.base_url}/oauth2/token"
        response = self._request_with_retry("POST", token_url, headers=headers, data=data)
        response.raise_for_status()
        return response.json()

    def get_site_info(self, access_token: str) -> Dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }
        if self.client_id:
            headers["wix-client-id"] = self.client_id
        response = self._request_with_retry("GET", f"{self.base_url}/sites/v1/site", headers=headers)
        if response.status_code == 404:
            logger.debug(
                "Wix site info not found (404) — user may not have a published site or token lacks sites scope"
            )
            return {"_no_site": True, "error": "No Wix site found for this account"}
        if response.status_code == 401:
            logger.warning(
                "Wix site info request unauthorized (401) — token expired or invalid"
            )
            return {"_auth_failed": True, "error": "Token expired or invalid — reconnect required"}
        response.raise_for_status()
        return response.json()

    def get_current_member(self, access_token: str, client_id: Optional[str]) -> Dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }
        if client_id:
            headers["wix-client-id"] = client_id
        response = self._request_with_retry(
            "GET",
            f"{self.base_url}/members/v1/members/my",
            headers=headers,
        )
        response.raise_for_status()
        return response.json()


