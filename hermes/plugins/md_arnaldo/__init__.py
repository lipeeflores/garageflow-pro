"""md_arnaldo — blindagem determinística do perfil Arnaldo (MD Mecânica).

Habilitado SOMENTE em profiles/arnaldo-md-mecanica/config.yaml (plugins.enabled).

- pre_gateway_dispatch: pausa de manutenção (a equipe no privado passa), silêncio em grupo,
  DEBOUNCE (30s cliente; equipe sem espera), neutralização de comandos "/" e áudio ligado
  por padrão para a equipe.
- pre_tool_call: na 1ª ferramenta do sistema do turno, frase fixa de "um instante".
- gateway._send_voice_reply (embrulho): o áudio sai DEPOIS do texto, em segundo plano.
- pre_llm_call: injeta data/hora e QUEM fala (pelo número) + a muralha de sigilo financeiro.
- pre_tool_call: só leitura + MCP `oficina` passam; a chamada do MCP leva o chamador assinado (HMAC).
- transform_llm_output: tira markdown que o WhatsApp mostraria cru e barra valor/margem
  quando quem fala é do pátio.
- adapter.handle_message (embrulho): mensagem digitada pela oficina no celular (whatsapp_from_owner)
  nunca vira turno e faz o Arnaldo sair daquela conversa por 4 h (ou até a virada do dia).
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
    identity = core.resolve_identity(
        row[0], row[1], row[2], row[3], _aliases,
        os.environ.get("ARNALDO_TEST_MODE") == "1", os.environ.get("ARNALDO_TEST_CALLER") or None,
    )
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



def _pausa_libera(event: Any) -> bool:
    """Exceção da pausa: chats listados em <perfil>/PAUSA_EXCETO (um JID por linha) passam.

    15/10/2026: o Lipe quis o Arnaldo ativo SÓ no grupo MD Gerência enquanto o resto segue pausado.
    16/10/2026: no privado, quem está no equipe.json também passa. O 1º contato de alguém novo da
    equipe chega como @lid, que não dá para pôr no arquivo antes (caso do José, do pátio).
    """
    try:
        source = getattr(event, "source", None)
        chat = str(getattr(source, "chat_id", "") or "").strip()
        if not chat:
            return False
        try:
            with open(os.path.join(_home(), "PAUSA_EXCETO"), encoding="utf-8") as fh:
                liberados = {linha.strip() for linha in fh if linha.strip() and not linha.startswith("#")}
        except FileNotFoundError:
            liberados = set()
        if chat in liberados:
            return True
        if getattr(source, "chat_type", "dm") != "dm":
            return False
        return core.papel_de(_phone_from_source(source, event), _equipe()) in core.EQUIPE_PAPEIS
    except Exception:
        return False

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


# ── Humano assumiu ───────────────────────────────────────────────────────────
# Mensagem digitada pelo celular da oficina (WHATSAPP_FORWARD_OWNER_MESSAGES=true) chega com
# metadata["whatsapp_from_owner"]. NUNCA vira turno: registra que um humano assumiu o chat e
# descarta. Enquanto ele estiver no controle, as mensagens do cliente também são descartadas
# (e guardadas em humano-feed.jsonl). O filtro mora no adapter.handle_message porque a mensagem
# que chega com turno em andamento vai para a fila e NÃO passa por pre_gateway_dispatch (13/10).
_humano_lock = threading.Lock()
_humano_estado: Optional[dict] = None   # carregado do arquivo no primeiro uso
_humano_arquivo_estado = ""


def _humano_reset_para_teste() -> None:
    global _humano_estado
    _humano_estado = None


def _arquivo_humano(nome: str) -> str:
    return os.path.join(_home(), nome)


def _humano_do_dono(event: Any) -> bool:
    md = getattr(event, "metadata", None)
    return isinstance(md, dict) and bool(md.get("whatsapp_from_owner"))


def _chave_do_chat(source: Any) -> str:
    """Telefone do chat (quem é o cliente), pelo chat_id e seus apelidos. Nunca o user_id: na
    mensagem do dono o user_id é o do celular da oficina."""
    chat = str(getattr(source, "chat_id", "") or "")
    phone = core.phone_from_candidates([chat, *_aliases(chat)]) if chat else None
    return phone or chat


def _humano_auditar(tipo: str, chat_id: Any, extra: Optional[dict] = None) -> None:
    logger.warning("arnaldo %s: chat=%s", tipo, chat_id)
    try:
        linha = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "tipo": tipo, "chat": str(chat_id or "")[:60]}
        linha.update(extra or {})
        with open(_arquivo_humano("humano-auditoria.jsonl"), "a", encoding="utf-8") as fh:
            fh.write(json.dumps(linha, ensure_ascii=False) + "\n")
    except Exception:
        pass


def _humano_feed(chat_id: Any, texto: str) -> None:
    try:
        linha = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "chat": str(chat_id or "")[:60], "texto": (texto or "")[:2000]}
        with open(_arquivo_humano("humano-feed.jsonl"), "a", encoding="utf-8") as fh:
            fh.write(json.dumps(linha, ensure_ascii=False) + "\n")
    except Exception:
        pass


def _humano_deve_descartar(event: Any) -> bool:
    """True quando a mensagem NÃO pode virar turno (dono digitou, ou humano no controle)."""
    global _humano_estado
    source = getattr(event, "source", None)
    if "whatsapp" not in str(getattr(getattr(source, "platform", None), "value", getattr(source, "platform", ""))).lower():
        return False
    if getattr(source, "chat_type", "dm") != "dm":
        return False
    chave = _chave_do_chat(source)
    agora = time.time()
    with _humano_lock:
        if _humano_estado is None:
            _humano_estado = core.carregar_estado(_arquivo_humano("humano-assumiu.json"))
        if _humano_do_dono(event):
            core.registrar_humano(_humano_estado, chave, agora)
            try:
                core.gravar_estado(_arquivo_humano("humano-assumiu.json"), _humano_estado)
            except Exception as exc:
                logger.warning("humano-assumiu.json não gravou (vale só até reiniciar): %s", exc)
            quem = "dono"
        else:
            quem = ""
            em_controle = core.humano_no_controle(_humano_estado, chave, agora, core.inicio_do_dia_local(agora))
    if quem:
        _humano_auditar("humano_assumiu", getattr(source, "chat_id", ""), {"chars": len(getattr(event, "text", "") or "")})
        return True
    if not em_controle:
        return False
    if core.papel_de(chave, _equipe()) != core.CLIENTE:
        return False  # equipe falando com o Arnaldo pelo próprio número é outra conversa
    texto = getattr(event, "text", "") or "[mídia]"
    _humano_auditar("silencio_humano", getattr(source, "chat_id", ""))
    _humano_feed(getattr(source, "chat_id", ""), texto)
    return True


# ── Mais rápido para quem espera (16/10) ─────────────────────────────────────
# 1) Aviso de espera: na 1ª ferramenta do sistema de cada turno sai uma frase curta
#    ("Claro! Só um instante...") e só depois a resposta de verdade.
# 2) Áudio depois do texto: o Hermes gera o TTS ANTES de mandar o texto (run_turn.py,
#    _hmwa_deliver_turn_response), o que atrasava o texto em ~3 s. O áudio vai para segundo plano.
# 3) Equipe recebe áudio + texto por padrão (como o Márcio pediu), sem precisar listar o @lid.
_vivo = {"loop": None, "adapter": None}
_turnos_lock = threading.Lock()
_turnos: dict = {}           # session_id -> {"t0": ts, "avisou": bool}
_TURNO_TTL = 900.0
_voz_tarefas: set = set()    # referência forte: task sem dono pode ser coletada no meio
_ATRASO_VOZ_S = 1.0          # o texto sai primeiro mesmo se o TTS for instantâneo


def _turno_comecou(session_id: str) -> None:
    if not session_id:
        return
    agora = time.time()
    with _turnos_lock:
        for sid in [s for s, t in _turnos.items() if agora - t["t0"] > _TURNO_TTL]:
            _turnos.pop(sid, None)
        _turnos[session_id] = {"t0": agora, "avisou": False}


def _marcar_aviso(session_id: str) -> bool:
    """True só na 1ª vez do turno (e só se o turno foi aberto pelo pre_llm_call)."""
    with _turnos_lock:
        turno = _turnos.get(session_id)
        if turno is None or turno["avisou"]:
            return False
        turno["avisou"] = True
        return True


def _avisar_espera(session_id: str, tool_name: str) -> None:
    """Manda a frase de espera para o chat da sessão sem segurar a ferramenta."""
    texto = core.aviso_de_espera(tool_name)
    if not texto or not session_id:
        return
    row = _session_row(session_id)
    if not row or "whatsapp" not in str(row[0] or "").lower() or not row[3]:
        return  # CLI/teste: nada a avisar
    loop, adapter = _vivo["loop"], _vivo["adapter"]
    if loop is None or adapter is None or loop.is_closed():
        return
    if not _marcar_aviso(session_id):
        return
    _approve(texto)  # passa pela mesma trava de saída que todo o resto

    def _resultado(fut):
        try:
            fut.result()
        except Exception as exc:
            logger.warning("aviso de espera não saiu: %s", exc)

    asyncio.run_coroutine_threadsafe(adapter.send(row[3], texto), loop).add_done_callback(_resultado)
    logger.info("arnaldo aviso de espera (%s) para %s", tool_name, row[3])


def _voz_depois_do_texto(gateway: Any) -> None:
    if gateway is None or getattr(gateway, "_arnaldo_voz_depois", False):
        return
    orig = getattr(gateway, "_send_voice_reply", None)
    if not callable(orig):
        logger.warning("gateway sem _send_voice_reply: áudio continua ANTES do texto")
        return

    async def _em_segundo_plano(event, text):
        async def _tarefa():
            await asyncio.sleep(_ATRASO_VOZ_S)
            await orig(event, text)

        tarefa = asyncio.get_running_loop().create_task(_tarefa())
        _voz_tarefas.add(tarefa)
        tarefa.add_done_callback(_voz_tarefas.discard)

    gateway._send_voice_reply = _em_segundo_plano
    gateway._arnaldo_voz_depois = True
    logger.info("arnaldo: áudio sai depois do texto")


def _voz_padrao_equipe(gateway: Any, source: Any, papel: str) -> None:
    """Conversa da equipe sem modo de voz definido passa a ter áudio + texto (e fica gravado)."""
    if papel not in core.EQUIPE_PAPEIS or gateway is None:
        return
    modos = getattr(gateway, "_voice_mode", None)
    chave_de = getattr(gateway, "_voice_key_for_source", None)
    aplicar = getattr(gateway, "_apply_voice_mode", None)
    adapter = _vivo["adapter"]
    if not isinstance(modos, dict) or not callable(chave_de) or not callable(aplicar) or adapter is None:
        return
    chave = chave_de(source)
    if chave in modos:
        return  # alguém já escolheu (inclusive "off")
    aplicar(adapter, chave, source.chat_id, "all")
    logger.info("arnaldo: áudio ligado para a equipe em %s", chave)


def _guard_adapter(adapter: Any) -> None:
    """Embrulha o adapter do WhatsApp (idempotente): só texto aprovado sai."""
    if adapter is None or getattr(adapter, "_arnaldo_guarded", False):
        return
    orig_send = adapter.send
    orig_handle = getattr(adapter, "handle_message", None)

    async def handle_message(event, *args, **kw):
        _vivo["loop"] = asyncio.get_running_loop()
        try:
            if _humano_deve_descartar(event):
                return None
        except Exception as exc:
            logger.warning("filtro de humano falhou: %s", exc)
            if _humano_do_dono(event):
                return None  # mensagem do dono NUNCA vira turno, nem com o filtro quebrado
        return await orig_handle(event, *args, **kw)

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
    if orig_handle is not None:
        adapter.handle_message = handle_message
    for name in ("edit_message", "send_poll", "send_clarify", "send_location"):
        if hasattr(adapter, name):
            setattr(adapter, name, drop)
    for name in ("send_image", "send_image_file", "send_video", "send_document"):
        if hasattr(adapter, name):
            setattr(adapter, name, caption_filter(getattr(adapter, name)))
    adapter._arnaldo_guarded = True
    _vivo["adapter"] = adapter
    logger.info("arnaldo trava instalada em %s", type(adapter).__name__)


def _guard_gateway(gateway: Any) -> None:
    for platform, adapter in list((getattr(gateway, "adapters", None) or {}).items()):
        if "whatsapp" in str(getattr(platform, "value", platform)).lower():
            _guard_adapter(adapter)
            _vivo["adapter"] = adapter
    try:
        _voz_depois_do_texto(gateway)
    except Exception as exc:
        logger.warning("áudio depois do texto não instalado: %s", exc)


# ── Hooks ────────────────────────────────────────────────────────────────────

def on_pre_gateway_dispatch(event: Any = None, gateway: Any = None, session_store: Any = None, **_: Any):
    try:
        if gateway is not None:
            _guard_gateway(gateway)
        # Recado que a própria espera juntou: passa direto (só não fura a pausa).
        if espera.ja_liberado(event):
            motivo = None if _pausa_libera(event) else _paused()
            return {"action": "skip", "reason": f"arnaldo: {motivo}"} if motivo else None

        source = getattr(event, "source", None)
        motivo = None if _pausa_libera(event) else _paused()
        if motivo:
            logger.warning("arnaldo PAUSA (%s): de=%s texto=%.160s", motivo,
                           getattr(source, "user_id", None), getattr(event, "text", "") or "[sem texto]")
            return {"action": "skip", "reason": f"arnaldo: {motivo}"}

        platform = getattr(getattr(source, "platform", None), "value", None) or str(getattr(source, "platform", ""))
        if "whatsapp" not in str(platform).lower():
            return None

        chat_type = getattr(source, "chat_type", "dm")
        if chat_type == "group":
            # Grupo feito para falar com ele (equipe.json: responder_tudo) -> responde qualquer mensagem.
            if (_grupos().get(str(getattr(source, "chat_id", "") or "").strip()) or {}).get("responder_tudo"):
                return None
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
        phone = _phone_from_source(source, event)
        papel = core.papel_de(phone, _equipe())
        try:
            _voz_padrao_equipe(gateway, source, papel)
        except Exception as exc:
            logger.warning("áudio padrão da equipe falhou: %s", exc)
        if not espera.eh_texto(event):
            # Foto, áudio, documento: solta o que estava esperando e segue o fluxo normal.
            _espera.soltar_agora(chave)
            return reescrito

        espera_s = core.debounce_seconds(papel)
        if espera_s > 0 and _espera.segurar(chave, event, gateway, espera_s, texto=texto):
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
    _turno_comecou(session_id)
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
        identity = _identity_for_session(session_id)
        decisao = core.decide_tool_call(
            tool_name, args if isinstance(args, dict) else {}, session_id, identity,
            core.papel_de(identity, _equipe()), os.environ.get("ARNALDO_CALLER_SECRET", ""),
        )
        if decisao.get("action") in ("allow", "modify"):
            try:
                _avisar_espera(session_id, tool_name)
            except Exception as exc:
                logger.warning("aviso de espera falhou: %s", exc)
        return decisao
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
