"""cadastro — papel de quem fala pelo cadastro do garageflow (ação ``quem_sou`` da arnaldo-api).

16/10/2026: o Lipe cadastra a equipe pelo sistema e não quer manter lista em dois lugares. Mecânico
novo com telefone no garageflow passa a ser pátio para o plugin (pausa, sigilo, áudio, espera) sem
ninguém editar o equipe.json. Quem junta as duas fontes é ``core.combinar_papel``.

Regras:
- Cache por telefone, ``TTL_S`` (10 min). Vencido ou ausente, a próxima mensagem dessa pessoa
  espera a consulta: no gateway por ``await`` (o loop segue livre para as outras conversas), fora
  do loop bloqueando no máximo ``TIMEOUT_S``. Leitura só de memória (``ler``) nunca vai à rede.
- Falha (rede, timeout, HTTP, resposta estranha) = o sistema não respondeu: vale o equipe.json.
  A falha fica guardada ``FALHA_TTL_S`` para não martelar a API a cada mensagem.
- Só resposta ``ok: true`` com papel de pessoa conta (``core.papel_do_sistema``).
- Sem URL, token ou segredo no ambiente, fica desligado: tudo como antes (só equipe.json).
"""
from __future__ import annotations

import asyncio
import concurrent.futures
import json
import logging
import threading
import time
import urllib.request
from typing import Callable, Optional

from . import core

TTL_S = 600.0
FALHA_TTL_S = 60.0
TIMEOUT_S = 3.0
SESSAO = "arnaldo-papel"   # session_id do envelope assinado (a API só confere a assinatura)
_MAX_ENTRADAS = 2000


def consultar_quem_sou(
    phone: str, *, url: str, token: str, segredo: str, anon: str = "", timeout: float = TIMEOUT_S,
    abrir: Callable = urllib.request.urlopen, agora_ms: Optional[int] = None,
) -> dict:
    """POST assinado na arnaldo-api, igual ao que o MCP oficina faz. Lança em qualquer falha."""
    if not (url and token and segredo):
        raise RuntimeError("arnaldo-api sem configuração (ARNALDO_API_URL/TOKEN/CALLER_SECRET)")
    corpo = {"acao": "quem_sou", "args": {}, "caller": core.caller_envelope(phone, SESSAO, segredo, agora_ms)}
    headers = {"content-type": "application/json", "x-arnaldo-token": token}
    if anon:
        headers["authorization"] = f"Bearer {anon}"
    req = urllib.request.Request(url.rstrip("/"), data=json.dumps(corpo).encode(), headers=headers, method="POST")
    with abrir(req, timeout=timeout) as resp:
        bruto = resp.read()
    return core.papel_do_sistema(json.loads(bruto))


class Cadastro:
    def __init__(
        self,
        consultar: Callable[[str], dict],
        logger: logging.Logger,
        ativo: Callable[[], bool] = lambda: True,
        relogio: Callable[[], float] = time.monotonic,
        ttl: float = TTL_S,
        falha_ttl: float = FALHA_TTL_S,
        timeout: float = TIMEOUT_S,
    ):
        self._consultar = consultar
        self.log = logger
        self._ativo = ativo
        self._relogio = relogio
        self.ttl = ttl
        self.falha_ttl = falha_ttl
        self.timeout = timeout
        self._lock = threading.Lock()
        self._cache: dict = {}    # telefone -> {"t": relogio, "dado": {papel, nome} | None (falhou)}
        self._voando: dict = {}   # telefone -> concurrent.futures.Future
        self._pool = concurrent.futures.ThreadPoolExecutor(max_workers=4, thread_name_prefix="arnaldo-cadastro")

    # -- leitura --------------------------------------------------------------
    def _consultavel(self, phone: Optional[str]) -> bool:
        return bool(phone) and phone != core.SYSTEM and core.normalize_br_phone(phone) == phone and self._ativo()

    def fresco(self, phone: Optional[str]) -> bool:
        """True quando não há o que consultar agora (resposta ou falha ainda dentro da validade)."""
        if not self._consultavel(phone):
            return True
        with self._lock:
            ent = self._cache.get(phone)
        if ent is None:
            return False
        validade = self.ttl if ent["dado"] is not None else self.falha_ttl
        return self._relogio() - ent["t"] < validade

    def ler(self, phone: Optional[str]) -> Optional[dict]:
        """Só memória. Vencido ou ausente => None (vale o equipe.json) e atualiza em segundo plano."""
        if not self._consultavel(phone):
            return None
        if not self.fresco(phone):
            self._disparar(phone)
            return None
        with self._lock:
            ent = self._cache.get(phone)
        return ent["dado"] if ent else None

    async def garantir(self, phone: Optional[str]) -> Optional[dict]:
        """Para o loop do gateway: espera a consulta sem travar as outras conversas."""
        if self._consultavel(phone) and not self.fresco(phone):
            fut = self._disparar(phone)
            try:
                await asyncio.wait_for(asyncio.shield(asyncio.wrap_future(fut)), self.timeout + 0.5)
            except Exception:
                pass  # timeout: a consulta segue e preenche o cache; agora vale o equipe.json
        return self.ler(phone)

    def garantir_bloqueando(self, phone: Optional[str]) -> Optional[dict]:
        """Fora do loop (thread do agente, CLI): espera no máximo ``timeout``."""
        if self._consultavel(phone) and not self.fresco(phone):
            try:
                self._disparar(phone).result(timeout=self.timeout + 0.5)
            except Exception:
                pass
        return self.ler(phone)

    # -- consulta -------------------------------------------------------------
    def _disparar(self, phone: str) -> concurrent.futures.Future:
        with self._lock:
            fut = self._voando.get(phone)
            if fut is None:
                fut = self._pool.submit(self._buscar, phone)
                self._voando[phone] = fut
            return fut

    def _buscar(self, phone: str) -> Optional[dict]:
        try:
            dado = self._consultar(phone)
        except Exception as exc:
            dado = None
            self.log.warning("arnaldo cadastro: quem_sou de %s falhou (%s); vale o equipe.json", phone, exc)
        with self._lock:
            anterior = (self._cache.get(phone) or {}).get("dado")
            self._cache[phone] = {"t": self._relogio(), "dado": dado}
            self._voando.pop(phone, None)
            if len(self._cache) > _MAX_ENTRADAS:
                for velho in sorted(self._cache, key=lambda k: self._cache[k]["t"])[: len(self._cache) - _MAX_ENTRADAS]:
                    self._cache.pop(velho, None)
        if dado is not None and dado != anterior and dado.get("papel") != core.CLIENTE:
            self.log.info("arnaldo cadastro: %s = %s (%s) pelo sistema", phone, dado.get("papel"), dado.get("nome") or "")
        return dado

    def limpar(self) -> None:
        with self._lock:
            self._cache.clear()
            self._voando.clear()
