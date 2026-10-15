"""md_arnaldo — blindagem determinística do perfil Arnaldo (MD Mecânica).

Habilitado SOMENTE em profiles/arnaldo-md-mecanica/config.yaml (plugins.enabled).

- pre_gateway_dispatch: pausa de manutenção, silêncio em grupo, DEBOUNCE (30s cliente /
  4s equipe) e neutralização de comandos "/".
- pre_llm_call: injeta data/hora e QUEM fala (pelo número) + a muralha de sigilo financeiro.
- pre_tool_call: Arnaldo ainda não tem ferramentas de negócio; só leitura passa.
- transform_llm_output: tira markdown que o WhatsApp mostraria cru e barra valor/margem
  quando quem fala é do pátio.
- post_api_request + trava de saída no adapter: só sai no WhatsApp o texto que o modelo
  escreveu (erro do gateway, "reiniciando", aviso de provedor: barrado e auditado).
"""
from __future__ import annotations

import asyncio
import dataclasses
import json
import logging
import os
import sqlite3
import threading
import time
from typing import Any, Optional

from . import core, espera

logger = logging.getLogger("md_arnaldo")


def _home() -> str:
    try:
        from hermes_constants import get_hermes_home

        return str(get_hermes_home())
    except Exception:  # pragma: no cover
        return os.environ.get("HERMES_HOME", "/root/.hermes/profiles/arnaldo-md-mecanica")


# ── Equipe (quem é quem, pelo número) ────────────────────────────────────────
# Arquivo simples no perfil: nenhum sistema da oficina está ligado ainda. Recarrega
# sozinho quando o arquivo muda, para o Lipe cadastrar gente sem reiniciar nada.
_equipe_lock = threading.Lock()
_equipe_cache = {"mtime": 0.0, "indice": {}, "grupos": {}}


def _equipe_path() -> str:
    return os.path.join(_home(), "equipe.json")


def _carregar() -> tuple:
    """(quem é quem, grupos). Falha na leitura => todo mundo cliente, nenhum grupo financeiro."""
    path = _equipe_path()
    try:
        mtime = os.path.getmtime(path)
    except OSError:
        return {}, {}
    with _equipe_lock:
        if mtime == _equipe_cache["mtime"]:
            return _equipe_cache["indice"], _equipe_cache["grupos"]
    try:
        with open(path, encoding="utf-8") as fh:
            dados = json.load(fh)
        indice = core.equipe_index(dados.get("equipe") or [])
        grupos = core.grupos_index(dados.get("grupos") or {})
    except Exception as exc:
        logger.warning("equipe.json ilegível (%s): todo mundo vira cliente", exc)
        indice, grupos = {}, {}
    with _equipe_lock:
        _equipe_cache.update({"mtime": mtime, "indice": indice, "grupos": grupos})
    return indice, grupos


def _equipe() -> dict:
    return _carregar()[0]


def _grupos() -> dict:
    return _carregar()[1]


def _aliases(identifier: str):
    try:
        from gateway.whatsapp_identity import expand_whatsapp_aliases

        return expand_whatsapp_aliases(identifier)
    except Exception:
        return set()


def _session_row(session_id: str) -> Optional[tuple]:
    path = os.path.join(_home(), "state.db")
    try:
        con = sqlite3.connect(f"file:{path}?mode=ro", uri=True, timeout=2)
        try:
            return con.execute(
                "select source, session_key, user_id, chat_id from sessions where id=?", (session_id,)
            ).fetchone()
        finally:
            con.close()
    except Exception as exc:
        logger.warning("state.db lookup falhou: %s", exc)
        return None


def _identity_for_session(session_id: str) -> Optional[str]:
    return _quem_e_onde(session_id)[0]


def _quem_e_onde(session_id: str) -> tuple:
    """(telefone de quem fala, jid do grupo ou None). A plateia importa tanto quanto o falante."""
    row = _session_row(session_id) or ("cli", None, None, None)
    identity = core.resolve_identity(row[0], row[1], row[2], row[3], _aliases)
    return identity, core.grupo_from_session_key(row[1])


def _phone_from_source(source: Any, event: Any) -> Optional[str]:
    for ident in (getattr(source, "chat_id", None), getattr(source, "user_id", None), getattr(event, "user_id", None)):
        if ident:
            phone = core.phone_from_candidates([ident, *_aliases(ident)])
            if phone:
                return phone
    return None


def _paused() -> Optional[str]:
    """Pausa de manutenção: enquanto <perfil>/PAUSA existir, nada chega ao modelo."""
    try:
        with open(os.path.join(_home(), "PAUSA"), encoding="utf-8") as fh:
            return fh.read().strip() or "pausa de manutencao"
    except FileNotFoundError:
        return None
    except Exception:
        return "pausa de manutencao"


# ── Espera do recado picado ──────────────────────────────────────────────────
# O Hermes só junta mensagens enquanto o agente está OCUPADO. Aqui a conversa espera
# o silêncio antes de virar turno (espera.py, idêntico ao da Isabelle). Até 08/10 o
# recado juntado era solto em ``gateway._handle_message`` e a resposta era jogada fora;
# agora volta pelo adapter, que é quem envia.
_espera = espera.Espera("arnaldo", logger, lambda: _home(), teto=core.DEBOUNCE_TETO)


# ── Trava de saída ───────────────────────────────────────────────────────────
_GUARD_TTL = 900.0
_guard_lock = threading.Lock()
_model_texts: dict = {}   # session_id -> [(ts, texto)]
_approved: list = []      # [(ts, texto)]


def _prune(items: list, now: float) -> list:
    return [it for it in items if now - it[0] < _GUARD_TTL][-50:]


def _remember_model_text(session_id: str, text: str) -> None:
    now = time.time()
    with _guard_lock:
        _model_texts[session_id] = _prune(_model_texts.get(session_id, []), now) + [(now, text)]
        for sid in [s for s, v in _model_texts.items() if not v or now - v[-1][0] > _GUARD_TTL]:
            _model_texts.pop(sid, None)


def _approve(text: str) -> None:
    now = time.time()
    with _guard_lock:
        _approved[:] = _prune(_approved, now) + [(now, text)]


def _approved_texts() -> list:
    now = time.time()
    with _guard_lock:
        _approved[:] = _prune(_approved, now)
        return [t for _, t in _approved]


def _auditar(tipo: str, chat_id: Any, conteudo: str) -> None:
    logger.warning("arnaldo trava: barrado %s para %s: %.160s", tipo, chat_id, conteudo)
    try:
        linha = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "tipo": f"saida_bloqueada:{tipo}",
            "chat": str(chat_id or "")[:40],
            "conteudo": (conteudo or "")[:400],
        }
        with open(os.path.join(_home(), "saidas-bloqueadas.jsonl"), "a", encoding="utf-8") as fh:
            fh.write(json.dumps(linha, ensure_ascii=False) + "\n")
    except Exception:
        pass


def _fake_ok():
    try:
        from gateway.platforms.base import SendResult

        return SendResult(success=True, message_id=None)
    except Exception:  # pragma: no cover
        return None


def _guard_adapter(adapter: Any) -> None:
    """Embrulha o adapter do WhatsApp (idempotente): só texto aprovado sai."""
    if adapter is None or getattr(adapter, "_arnaldo_guarded", False):
        return
    orig_send = adapter.send

    async def send(chat_id, content, reply_to=None, metadata=None, **kw):
        if not core.outbound_allowed(content, _approved_texts()):
            _auditar("texto", chat_id, content or "")
            return _fake_ok()
        return await orig_send(chat_id, content, reply_to=reply_to, metadata=metadata, **kw)

    async def drop(*args, **kw):
        _auditar("interativo", args[0] if args else kw.get("chat_id"),
                 json.dumps([str(a)[:80] for a in args[1:]], ensure_ascii=False))
        return _fake_ok()

    def caption_filter(orig):
        async def wrapped(*args, **kw):
            cap = kw.get("caption")
            if cap and not core.outbound_allowed(cap, _approved_texts()):
                _auditar("legenda", args[0] if args else kw.get("chat_id"), cap)
                kw["caption"] = None
            return await orig(*args, **kw)
        return wrapped

    adapter.send = send
    for name in ("edit_message", "send_poll", "send_clarify", "send_location"):
        if hasattr(adapter, name):
            setattr(adapter, name, drop)
    for name in ("send_image", "send_image_file", "send_video", "send_document"):
        if hasattr(adapter, name):
            setattr(adapter, name, caption_filter(getattr(adapter, name)))
    adapter._arnaldo_guarded = True
    logger.info("arnaldo trava instalada em %s", type(adapter).__name__)


def _guard_gateway(gateway: Any) -> None:
    for platform, adapter in list((getattr(gateway, "adapters", None) or {}).items()):
        if "whatsapp" in str(getattr(platform, "value", platform)).lower():
            _guard_adapter(adapter)


# ── Hooks ────────────────────────────────────────────────────────────────────

def on_pre_gateway_dispatch(event: Any = None, gateway: Any = None, session_store: Any = None, **_: Any):
    try:
        if gateway is not None:
            _guard_gateway(gateway)
        # Recado que a própria espera juntou: passa direto (só não fura a pausa).
        if espera.ja_liberado(event):
            motivo = _paused()
            return {"action": "skip", "reason": f"arnaldo: {motivo}"} if motivo else None

        source = getattr(event, "source", None)
        motivo = _paused()
        if motivo:
            logger.warning("arnaldo PAUSA (%s): de=%s texto=%.160s", motivo,
                           getattr(source, "user_id", None), getattr(event, "text", "") or "[sem texto]")
            return {"action": "skip", "reason": f"arnaldo: {motivo}"}

        platform = getattr(getattr(source, "platform", None), "value", None) or str(getattr(source, "platform", ""))
        if "whatsapp" not in str(platform).lower():
            return None

        chat_type = getattr(source, "chat_type", "dm")
        if chat_type == "group":
            raw = getattr(event, "raw_message", None) or {}
            chamado = core.chamado_no_grupo(
                getattr(event, "text", "") or "", raw.get("botIds") or [], raw.get("mentionedIds") or [],
                bool(getattr(event, "reply_to_is_own_message", False)),
            )
            if not chamado:
                return {"action": "skip", "reason": "grupo: ninguem chamou o Arnaldo"}
            return None
        if chat_type != "dm":
            return None

        texto = getattr(event, "text", "") or ""
        neutro = core.neutralize_command(texto)
        if neutro is not None:
            event = dataclasses.replace(event, text=neutro)
            texto = neutro

        chave = espera.chave_de(source)
        reescrito = {"action": "rewrite", "text": neutro} if neutro is not None else None
        if gateway is None:
            return reescrito
        if not espera.eh_texto(event):
            # Foto, áudio, documento: solta o que estava esperando e segue o fluxo normal.
            _espera.soltar_agora(chave)
            return reescrito

        phone = _phone_from_source(source, event)
        papel = core.papel_de(phone, _equipe())
        if _espera.segurar(chave, event, gateway, core.debounce_seconds(papel), texto=texto):
            return {"action": "skip", "reason": f"arnaldo: juntando mensagens ({papel})"}
        return reescrito
    except Exception as exc:
        logger.warning("pre_gateway_dispatch falhou: %s", exc)
        try:
            if getattr(getattr(event, "source", None), "chat_type", "dm") == "group":
                return {"action": "skip", "reason": "grupo: plugin falhou, silencio por seguranca"}
        except Exception:
            pass
        return None


def on_pre_llm_call(session_id: str = "", platform: str = "", user_message: Any = "", **_: Any):
    try:
        from datetime import datetime
        from zoneinfo import ZoneInfo

        identity, grupo = _quem_e_onde(session_id)
        agora = datetime.now(ZoneInfo("America/Sao_Paulo"))
        return {"context": core.turn_context(identity, _equipe(), agora, grupo, _grupos())}
    except Exception as exc:
        logger.warning("pre_llm_call falhou: %s", exc)
        return None


def on_pre_tool_call(tool_name: str = "", args: Any = None, session_id: str = "", **_: Any):
    try:
        return core.decide_tool_call(tool_name, _identity_for_session(session_id))
    except Exception as exc:
        logger.warning("pre_tool_call falhou: %s", exc)
        return {"action": "block", "message": "Falha ao validar a ação; nada foi executado."}


def on_post_api_request(session_id: str = "", assistant_message: Any = None, **_: Any):
    try:
        content = getattr(assistant_message, "content", None)
        if isinstance(content, str) and content.strip():
            _remember_model_text(session_id or "", content)
    except Exception as exc:
        logger.warning("post_api_request falhou: %s", exc)
    return None


def on_transform_llm_output(response_text: str = "", session_id: str = "", platform: str = "", **_: Any):
    try:
        if not response_text:
            return None
        with _guard_lock:
            model_texts = [t for _, t in _model_texts.get(session_id or "", [])]
        if not core.is_model_derived(response_text, model_texts):
            _auditar("resposta_nao_do_modelo", session_id, response_text)
            return None
        is_whatsapp = "whatsapp" in str(platform).lower()
        limpo = core.sanitize_whatsapp(response_text) if is_whatsapp else response_text
        if is_whatsapp:
            identity, grupo = _quem_e_onde(session_id)
            papel = core.papel_de(identity, _equipe())
            limpo, vazou = core.filtrar_saida(limpo, papel, grupo, _grupos())
            if vazou:
                _auditar("sigilo_financeiro", session_id, response_text)
        _approve(limpo)
        return limpo if limpo != response_text else None
    except Exception as exc:
        logger.warning("transform_llm_output falhou: %s", exc)
    return None


def _guard_future_adapters() -> None:
    """Embrulha a fábrica do adapter para a trava existir antes da primeira mensagem."""
    try:
        from gateway.platform_registry import platform_registry

        entry = platform_registry.get("whatsapp")
        if entry is None or getattr(entry.adapter_factory, "_arnaldo_wrapped", False):
            return
        orig = entry.adapter_factory

        def factory(cfg):
            adapter = orig(cfg)
            _guard_adapter(adapter)
            return adapter

        factory._arnaldo_wrapped = True
        entry.adapter_factory = factory
    except Exception as exc:
        logger.info("fábrica de adapter não embrulhada (a trava entra na 1ª mensagem): %s", exc)


def register(ctx) -> None:
    # Ganchos primeiro e retorno rápido: o Hermes >= 0.21 dá 10 s para cada plugin carregar e
    # DESCARTA todos os ganchos de quem passa disso. Importar gateway.* aqui travava no lock de
    # import que o próprio gateway segura no boot (a Isabelle, com o mesmo código, ficou de
    # 25/09 a 03/10 com toda resposta bloqueada). A trava do adapter sobe numa thread; o
    # pre_gateway_dispatch também a instala.
    ctx.register_hook("post_api_request", on_post_api_request)
    ctx.register_hook("pre_gateway_dispatch", on_pre_gateway_dispatch)
    ctx.register_hook("pre_llm_call", on_pre_llm_call)
    ctx.register_hook("pre_tool_call", on_pre_tool_call)
    ctx.register_hook("transform_llm_output", on_transform_llm_output)
    threading.Thread(target=_guard_future_adapters, name="arnaldo-guard-install", daemon=True).start()
