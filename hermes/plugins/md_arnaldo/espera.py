"""espera — junta o recado picado do cliente antes de virar turno ("oi" / "tudo bem?" /
"quero uma lancha" => uma resposta so).

O Hermes NAO tem isso: o lote nativo do WhatsApp espera no maximo 2 s, e o modo ``queue``
so junta enquanto o agente ja esta ocupado. Aqui a conversa espera o SILENCIO do cliente.

Arquivo IDENTICO em lanchas_isabelle/ e md_arnaldo/ (cada plugin e um pacote isolado).
Mudou um, copie no outro.

Como solta: o recado juntado volta pela PORTA DA FRENTE do WhatsApp
(``adapter.handle_message``), a mesma que a mensagem original usaria — e ela que manda a
resposta. (Ate 08/10 o Arnaldo soltava em ``gateway._handle_message``: a resposta era gerada
e jogada fora, porque quem envia e o adapter.) A mensagem solta leva a marca
``metadata["_espera_liberada"]`` e o plugin deixa ela passar direto.

Falha aberta: qualquer erro deixa a mensagem seguir na hora; o que nao der para soltar
fica gravado em ``espera-perdidas.jsonl``. Recado de cliente nunca some calado.
"""
from __future__ import annotations

import asyncio
import dataclasses
import json
import logging
import os
import threading
import time
from typing import Any, Callable, Iterable, Optional

MARCA = "_espera_liberada"


def juntar_textos(partes: Iterable[str]) -> str:
    """Junta as mensagens picadas numa so, uma por linha, sem repetir linha identica seguida."""
    limpo: list[str] = []
    for parte in partes:
        parte = (parte or "").strip()
        if parte and (not limpo or limpo[-1] != parte):
            limpo.append(parte)
    return "\n".join(limpo)


def ja_liberado(event: Any) -> bool:
    md = getattr(event, "metadata", None)
    return isinstance(md, dict) and bool(md.get(MARCA))


def eh_texto(event: Any) -> bool:
    tipo = getattr(event, "message_type", None)
    tipo = str(getattr(tipo, "value", tipo) or "").lower()
    return "text" in tipo and bool((getattr(event, "text", "") or "").strip())


def chave_de(source: Any) -> str:
    return f"{getattr(source, 'chat_id', '?')}|{getattr(source, 'user_id', '?')}"


def _adapter_de(gateway: Any, event: Any) -> Any:
    adapters = getattr(gateway, "adapters", None) or {}
    plataforma = getattr(getattr(event, "source", None), "platform", None)
    ad = adapters.get(plataforma) if plataforma is not None else None
    if ad is None:
        for chave, valor in adapters.items():
            if "whatsapp" in str(getattr(chave, "value", chave)).lower():
                ad = valor
                break
    return ad


class Espera:
    def __init__(self, nome: str, logger: logging.Logger, pasta: Callable[[], str], teto: float = 120.0):
        self.nome = nome
        self.log = logger
        self.pasta = pasta
        self.teto = teto
        self._lock = threading.Lock()
        self._buffers: dict = {}  # chave -> {"textos", "event", "timer", "inicio", "gateway"}

    # -- entrada ------------------------------------------------------------
    def segurar(self, chave: str, event: Any, gateway: Any, atraso: float, texto: Optional[str] = None) -> bool:
        """Guarda o pedaco e (re)arma o relogio. False = nao deu para segurar (deixe passar)."""
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return False
        if _adapter_de(gateway, event) is None or not callable(getattr(_adapter_de(gateway, event), "handle_message", None)):
            self.log.error("%s espera: adapter do WhatsApp sem handle_message — ESPERA DESLIGADA", self.nome)
            return False
        with self._lock:
            agora = time.monotonic()
            estado = self._buffers.get(chave)
            if estado is None:
                estado = {"textos": [], "event": event, "timer": None, "inicio": agora, "gateway": gateway}
                self._buffers[chave] = estado
            estado["textos"].append(texto if texto is not None else (getattr(event, "text", "") or ""))
            estado["event"] = event
            estado["gateway"] = gateway
            if estado["timer"] is not None:
                estado["timer"].cancel()
            # Teto: cliente que nunca para de digitar ainda assim e atendido.
            restante = max(0.0, estado["inicio"] + self.teto - agora)
            estado["timer"] = loop.call_later(min(atraso, restante), self._liberar, chave)
        return True

    def soltar_agora(self, chave: str) -> None:
        """Chegou foto/audio/documento: solta o texto que estava esperando ANTES da midia."""
        with self._lock:
            estado = self._buffers.get(chave)
            if estado and estado["timer"] is not None:
                estado["timer"].cancel()
                estado["timer"] = None
        if estado:
            self._liberar(chave)

    def pendentes(self) -> int:
        with self._lock:
            return len(self._buffers)

    # -- saida --------------------------------------------------------------
    def _liberar(self, chave: str) -> None:
        with self._lock:
            estado = self._buffers.pop(chave, None)
        if not estado:
            return
        textos = estado["textos"]
        try:
            texto = juntar_textos(textos)
            if not texto:
                return
            ev = estado["event"]
            md = dict(getattr(ev, "metadata", None) or {})
            md[MARCA] = True
            evento = dataclasses.replace(ev, text=texto, metadata=md)
            adapter = _adapter_de(estado["gateway"], evento)
            tarefa = asyncio.ensure_future(adapter.handle_message(evento))
            tarefa.add_done_callback(lambda t, c=chave, tx=textos: self._conferir(t, c, tx))
            self.log.info("%s espera: liberando %d mensagem(ns) de %s", self.nome, len(textos), chave)
        except Exception as exc:
            self.log.error("%s espera: NAO consegui liberar %s (%s) — mensagens gravadas", self.nome, chave, exc)
            self._perdida(chave, textos, str(exc))

    def _conferir(self, tarefa: Any, chave: str, textos: list) -> None:
        try:
            exc = tarefa.exception()
        except BaseException as e:  # cancelada
            exc = e
        if exc is not None:
            self.log.error("%s espera: entrega de %s falhou (%s) — mensagens gravadas", self.nome, chave, exc)
            self._perdida(chave, textos, str(exc))

    def _perdida(self, chave: str, textos: list, motivo: str) -> None:
        try:
            linha = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "agente": self.nome,
                     "chave": chave, "motivo": motivo, "textos": textos}
            with open(os.path.join(self.pasta(), "espera-perdidas.jsonl"), "a", encoding="utf-8") as fh:
                fh.write(json.dumps(linha, ensure_ascii=False) + "\n")
        except Exception:
            pass
