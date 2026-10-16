"""Pure decision logic for the md_arnaldo plugin (no Hermes imports, unit-testable)."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import time
import unicodedata
from typing import Callable, Iterable, Optional

SYSTEM = "SYSTEM"

# Hermes built-ins that only read. Tudo que e de negocio vem do MCP `oficina`
# (prefixo abaixo); qualquer outra ferramenta e bloqueada de proposito.
SAFE_BUILTINS = frozenset({"tool_search", "tool_describe", "skills_list", "skill_view", "vision_analyze"})

# Papeis. A parede do dinheiro separa DONO/GESTAO (ve tudo) de PATIO (nunca ve valor).
DONO = "dono"
GESTAO = "gestao"
PATIO = "patio"
CLIENTE = "cliente"
DESCONHECIDO = "desconhecido"

VE_DINHEIRO = frozenset({DONO, GESTAO})
EQUIPE_PAPEIS = frozenset({DONO, GESTAO, PATIO})


def normalize_br_phone(raw: Optional[str]) -> Optional[str]:
    """55 + DDD + numero, celular com o nono digito. Mesma regra usada na Isabelle."""
    s = str(raw or "")
    if s.endswith("@lid"):
        return None
    digits = re.sub(r"\D", "", s.split("@")[0])
    if len(digits) in (10, 11):
        digits = "55" + digits
    if not digits.startswith("55") or len(digits) not in (12, 13):
        return None
    if len(digits) == 12 and digits[4] in "6789":
        digits = digits[:4] + "9" + digits[4:]
    return digits


def phone_from_candidates(candidates: Iterable[Optional[str]]) -> Optional[str]:
    for c in candidates:
        phone = normalize_br_phone(c)
        if phone:
            return phone
    return None


def phone_from_session_key(session_key: Optional[str]) -> Optional[str]:
    """DM termina em ``:whatsapp:dm:<telefone>``; grupo em ``:whatsapp:group:<jid>:<telefone>``."""
    m = re.search(r":whatsapp:(?:dm|group:[^:]+):(\d{10,13})$", session_key or "")
    return normalize_br_phone(m.group(1)) if m else None


def grupo_from_session_key(session_key: Optional[str]) -> Optional[str]:
    """JID do grupo, quando a conversa e em grupo. None em DM."""
    m = re.search(r":whatsapp:group:([^:]+):\d{10,13}$", session_key or "")
    return m.group(1) if m else None


def resolve_identity(
    source: Optional[str],
    session_key: Optional[str],
    user_id: Optional[str],
    chat_id: Optional[str],
    expand_aliases: Callable[[str], Iterable[str]],
    test_mode: bool = False,
    test_caller: Optional[str] = None,
) -> Optional[str]:
    """Mapeia a sessao para QUEM fala. Nunca adivinha.

    Modo de teste (``ARNALDO_TEST_MODE=1``): so vale em sessao ``cli`` (use ``--source cli``; ``-q``
    sozinho vira sessao ``oneshot`` e ignora a variavel) e a identidade vem de ``ARNALDO_TEST_CALLER``.
    """
    if source == "whatsapp":
        phone = phone_from_session_key(session_key)
        if phone:
            return phone
        for ident in (user_id, chat_id):
            if ident:
                phone = phone_from_candidates([ident, *expand_aliases(ident)])
                if phone:
                    return phone
        return None
    if source == "cron":
        return SYSTEM
    if source == "cli" and test_mode and test_caller:
        return SYSTEM if test_caller == SYSTEM else normalize_br_phone(test_caller)
    return None


# -- Equipe -------------------------------------------------------------------

def equipe_index(equipe: Iterable[dict]) -> dict:
    """{telefone normalizado: {nome, papel}}. Telefone invalido é ignorado."""
    out = {}
    for pessoa in equipe or ():
        phone = normalize_br_phone(pessoa.get("telefone"))
        if not phone:
            continue
        papel = str(pessoa.get("papel") or "").strip().lower()
        if papel not in (DONO, GESTAO, PATIO):
            papel = PATIO
        out[phone] = {"nome": pessoa.get("nome") or "", "papel": papel}
    return out


def papel_de(identity: Optional[str], indice: dict) -> str:
    """Papel pelo NUMERO, unica fonte que vale. Desconhecido nunca vira equipe."""
    if identity == SYSTEM:
        return GESTAO
    if not identity:
        return DESCONHECIDO
    pessoa = indice.get(identity)
    return pessoa["papel"] if pessoa else CLIENTE


def ve_dinheiro(papel: str) -> bool:
    return papel in VE_DINHEIRO


# -- Cadastro do sistema (garageflow) -----------------------------------------
# 16/10: o papel também vem da arnaldo-api (ação quem_sou: profiles.phone + user_roles). O Lipe
# cadastra a equipe pelo sistema e não quer manter lista em dois lugares. O equipe.json fica de
# reforço (gente que ainda não tem telefone no sistema) e de reserva quando a API não responde.

PAPEIS_DO_SISTEMA = frozenset({DONO, GESTAO, PATIO, CLIENTE})


def papel_do_sistema(corpo) -> dict:
    """{papel, nome} da resposta do quem_sou. Fora do combinado => ValueError (= sistema não respondeu).

    "sistema" ou papel desconhecido nunca viram equipe: só valem os quatro papéis de pessoa.
    """
    if not isinstance(corpo, dict) or corpo.get("ok") is not True or not isinstance(corpo.get("dados"), dict):
        raise ValueError(f"resposta inesperada do quem_sou: {str(corpo)[:160]}")
    dados = corpo["dados"]
    papel = str(dados.get("papel") or "").strip().lower()
    if papel not in PAPEIS_DO_SISTEMA:
        raise ValueError(f"papel desconhecido no quem_sou: {papel!r}")
    nome = dados.get("nome")
    return {"papel": papel, "nome": nome.strip() if isinstance(nome, str) else ""}


def combinar_papel(sistema: Optional[dict], local: Optional[dict]) -> Optional[dict]:
    """Quem é a pessoa, juntando o cadastro do sistema e o equipe.json.

    1. O sistema respondeu com papel de equipe -> vale o do sistema (é lá que o Lipe cadastra).
    2. O sistema disse cliente, falhou ou nem foi consultado -> vale o equipe.json (reforço).
    3. Nenhum dos dois -> None (cliente).
    O sistema nunca rebaixa quem está no equipe.json, e falha nunca promove ninguém.
    """
    if sistema and sistema.get("papel") in EQUIPE_PAPEIS:
        nome = sistema.get("nome") or (local or {}).get("nome") or ""
        return {"nome": nome, "papel": sistema["papel"], "fonte": "sistema"}
    return local


def indice_com_sistema(identity: Optional[str], indice: dict, sistema: Optional[dict]) -> dict:
    """O índice do equipe.json com a pessoa ``identity`` ajustada pelo cadastro do sistema."""
    if not identity or identity == SYSTEM:
        return indice
    local = indice.get(identity)
    pessoa = combinar_papel(sistema, local)
    if pessoa is local:
        return indice
    novo = dict(indice)
    novo[identity] = pessoa
    return novo


def grupos_index(grupos: dict) -> dict:
    """{jid: {nome, financeiro}}. ``financeiro`` so vale se for exatamente True."""
    out = {}
    for jid, cfg in (grupos or {}).items():
        if not str(jid).strip():
            continue
        cfg = cfg if isinstance(cfg, dict) else {}
        out[str(jid).strip()] = {
            "nome": cfg.get("nome") or "",
            "financeiro": cfg.get("financeiro") is True,
            "responder_tudo": cfg.get("responder_tudo") is True,
        }
    return out


def ve_dinheiro_na_conversa(papel: str, grupo_jid: Optional[str], grupos: dict) -> bool:
    """A muralha vale pela PLATEIA, nao so por quem perguntou.

    Em DM, quem ve dinheiro e o papel de quem fala. Em GRUPO, a resposta e lida por todo mundo
    que esta la dentro — entao so sai valor em grupo declarado ``financeiro: true`` no
    equipe.json (grupo dos donos). Grupo desconhecido = sigilo ligado, sempre.
    """
    if not ve_dinheiro(papel):
        return False
    if not grupo_jid:
        return True
    return bool((grupos or {}).get(grupo_jid, {}).get("financeiro"))


# -- Contexto do turno --------------------------------------------------------

WEEKDAYS_PT = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"]


def turn_context(identity: Optional[str], indice: dict, now_local, grupo_jid=None, grupos=None) -> str:
    """Linha deterministica no inicio de cada turno: quando, quem fala e a parede do dinheiro."""
    quando = (
        f"{WEEKDAYS_PT[now_local.weekday()]}, {now_local.strftime('%d/%m/%Y')}, "
        f"{now_local.strftime('%H')}h{now_local.strftime('%M')} (Itapema/SC)"
    )
    papel = papel_de(identity, indice)
    pessoa = indice.get(identity or "") or {}
    nome = pessoa.get("nome") or ""
    if identity == SYSTEM:
        quem = "ROTINA AGENDADA (ninguem na conversa)"
    elif papel == DONO:
        quem = f"DONO — {nome}".strip(" —")
    elif papel == GESTAO:
        quem = f"GESTAO/FINANCEIRO — {nome}".strip(" —")
    elif papel == PATIO:
        quem = f"PATIO/MECANICO — {nome}".strip(" —")
    elif papel == CLIENTE:
        quem = "CLIENTE"
    else:
        quem = "DESCONHECIDO (trate como cliente e nao execute nada)"
    grupos = grupos or {}
    linhas = [f"[Sistema MD Mecanica] Agora: {quando}. Quem fala: {quem}."]
    if grupo_jid:
        nome_grupo = (grupos.get(grupo_jid) or {}).get("nome") or "grupo"
        linhas.append(
            f"Conversa em GRUPO ({nome_grupo}): todo mundo do grupo le a sua resposta. "
            "Nao trate nada como reservado a uma pessoa so."
        )
    if not ve_dinheiro_na_conversa(papel, grupo_jid, grupos):
        motivo = (
            "este grupo nao e o canal financeiro" if grupo_jid and ve_dinheiro(papel)
            else "quem fala nao ve valores"
        )
        linhas.append(
            f"SIGILO FINANCEIRO ATIVO nesta conversa ({motivo}): nao diga valor de servico, preco "
            "de peca, orcamento, desconto, margem, custo de compra nem faturamento. Se perguntarem, "
            "diga que isso e com a Dona Simone."
        )
    return "\n".join(linhas)


# -- Debounce -----------------------------------------------------------------

DEBOUNCE_EQUIPE = 0.0  # 15/10: Lipe pediu resposta imediata para a equipe
DEBOUNCE_CLIENTE = 30.0
DEBOUNCE_TETO = 180.0


def debounce_seconds(papel: str) -> float:
    """Pátio e gestao respondem quase na hora; cliente acumula o recado picado."""
    return DEBOUNCE_EQUIPE if papel in (DONO, GESTAO, PATIO) else DEBOUNCE_CLIENTE


def juntar_textos(partes: Iterable[str]) -> str:
    """Junta as mensagens picadas numa so, sem repetir linha identica seguida."""
    limpo = []
    for parte in partes:
        p = (parte or "").strip()
        if p and (not limpo or limpo[-1] != p):
            limpo.append(p)
    return "\n".join(limpo)


# -- Saida no WhatsApp --------------------------------------------------------

def sanitize_whatsapp(text: str) -> str:
    """WhatsApp mostra markdown literal: tira negrito/italico, divisorias e cerquilha de titulo."""
    out = re.sub(r"\*\*(.+?)\*\*", r"\1", text, flags=re.S)
    out = re.sub(r"__(.+?)__", r"\1", out, flags=re.S)
    out = re.sub(r"(?<![\w*])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![\w*])", r"\1", out)
    out = re.sub(r"(?m)^[ \t]*(?:-{3,}|—{2,}|_{3,})[ \t]*$", "", out)
    out = re.sub(r"(?m)^#{1,6}[ \t]+", "", out)
    out = re.sub(r"\n{3,}", "\n\n", out)
    return out.strip()


def norm_for_match(text: Optional[str]) -> str:
    """So letras e digitos, minusculo, sem acento — sobrevive a limpeza de markdown e ao picote."""
    folded = unicodedata.normalize("NFKD", text or "")
    folded = "".join(ch for ch in folded if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", "", folded.lower())


def is_model_derived(final_text: str, model_texts: Iterable[str]) -> bool:
    """True quando o texto final do turno saiu do modelo (e nao de um aviso do gateway)."""
    nf = norm_for_match(final_text)
    if not nf:
        stripped = (final_text or "").strip()
        return bool(stripped) and any(stripped == (m or "").strip() for m in model_texts)
    for m in model_texts:
        nm = norm_for_match(m)
        if not nm:
            continue
        if nf == nm:
            return True
        if nf in nm and len(nf) >= 0.6 * len(nm):
            return True
    return False


def outbound_allowed(content: str, approved: Iterable[str]) -> bool:
    """Um pedaco so sai se fizer parte de uma resposta aprovada."""
    raw = (content or "").strip()
    if not raw:
        return True
    nc = norm_for_match(raw)
    approved = list(approved)
    if not nc:
        return any(raw in (a or "") for a in approved)
    return any(nc in norm_for_match(a) for a in approved if norm_for_match(a))


def neutralize_command(text: str) -> Optional[str]:
    """Barra no inicio viraria comando do gateway: reescreve como texto."""
    stripped = (text or "").lstrip()
    if not stripped.startswith("/"):
        return None
    return stripped.lstrip("/").lstrip() or "oi"


# -- Parede do dinheiro na saida ---------------------------------------------

# Valor em real, percentual e as palavras de dinheiro que nao podem sair para o patio.
# A palavra "orcamento" sozinha NAO e vazamento (desde 16/10): o Arnaldo manda o link do orcamento
# ao cliente e diz que a aprovacao esta pendente. O que vaza e o NUMERO (R$, reais, %).
_DINHEIRO = re.compile(
    r"(r\$\s*\d)"
    r"|(\d[\d.,]*\s*(?:reais|contos|mil\s+reais))"
    r"|(\d[\d.,]*\s*%)"
    r"|(\bmargem\b)|(\blucro\b)|(\bfaturamento\b)|(\bdesconto\b)",
    re.I,
)

RECUSA_SIGILO = (
    "Valor quem passa é a Dona Simone — comigo aqui a gente vê só a parte técnica do serviço."
)


def vaza_dinheiro(texto: str) -> bool:
    """True quando a resposta carrega valor/margem que nao pode chegar ao patio."""
    return bool(_DINHEIRO.search(texto or ""))


def filtrar_saida(texto: str, papel: str, grupo_jid=None, grupos=None) -> tuple:
    """(texto que pode sair, vazou?). Onde nao pode haver dinheiro, troca a resposta inteira."""
    if ve_dinheiro_na_conversa(papel, grupo_jid, grupos or {}) or not vaza_dinheiro(texto):
        return texto, False
    return RECUSA_SIGILO, True


# -- Ferramentas --------------------------------------------------------------

TOOL_PREFIX = "mcp__oficina__"

# O que o CLIENTE pode chamar. O resto e so da equipe. A API decide o papel de novo, de forma
# independente (pelo telefone assinado); o bloqueio aqui economiza uma ida a API e da mensagem melhor.
CLIENT_TOOLS = frozenset({
    "quem_sou", "meus_dados", "cadastrar_cliente_veiculo", "status_do_carro", "horarios_livres",
    "agendar", "meus_agendamentos", "remarcar", "cancelar_agendamento",
    # consultar_placa: dado publico do veiculo. gerar_documento: o cliente pede o proprio orcamento/recibo;
    # quem decide o que ele pode receber (so a OS do proprio veiculo) e a API.
    "consultar_placa", "gerar_documento",
})


def sign(phone: str, session_id: str, ts: int, secret: str) -> str:
    return hmac.new(secret.encode(), f"{phone}|{session_id}|{ts}".encode(), hashlib.sha256).hexdigest()


def caller_envelope(phone: str, session_id: str, secret: str, now_ms: Optional[int] = None) -> dict:
    ts = int(now_ms if now_ms is not None else time.time() * 1000)
    return {"phone": phone, "session_id": session_id, "ts": ts, "sig": sign(phone, session_id, ts, secret)}


def decide_tool_call(
    tool_name: str,
    args: Optional[dict],
    session_id: str,
    identity: Optional[str],
    papel: str,
    secret: str,
    now_ms: Optional[int] = None,
) -> dict:
    """Diretiva de pre_tool_call.

    identity: telefone canonico, SYSTEM (cron) ou None quando desconhecido (nunca se adivinha).
    Duas familias: os builtins de leitura (SAFE_BUILTINS) e o MCP `oficina` (assinado aqui).
    Qualquer outra coisa (terminal, execute_code, web...) e bloqueada para todos os papeis.
    """
    if tool_name in SAFE_BUILTINS:
        return {"action": "allow"}
    if not identity:
        return {"action": "block", "message": "Não consegui identificar de qual número vem esta conversa; a ação não foi executada."}
    if not tool_name.startswith(TOOL_PREFIX):
        return {"action": "block", "message": "Essa ferramenta não está disponível para o Arnaldo."}
    if papel == DESCONHECIDO:
        return {"action": "block", "message": "Não consegui identificar quem está falando; a ação não foi executada."}
    nome = tool_name[len(TOOL_PREFIX):]
    if papel == CLIENTE and nome not in CLIENT_TOOLS:
        return {"action": "block", "message": "Essa ação é só para a equipe da oficina."}
    if not secret:
        return {"action": "block", "message": "Sistema da oficina sem configuração de segurança; a ação não foi executada."}
    novos = dict(args or {})
    novos.pop("caller", None)  # nunca confiar no que o modelo mandou
    novos["caller"] = caller_envelope(identity, session_id, secret, now_ms)
    return {"action": "modify", "args": novos}


# -- Aviso de espera ----------------------------------------------------------
# 16/10 (Lipe): quando o Arnaldo vai ao sistema, a resposta leva de 15 a 35 s (ferramenta + mais
# uma volta do modelo). Antes disso sai uma frase curta, uma vez por turno. Texto fixo, decidido
# aqui: não depende do modelo lembrar e não tem como vazar valor.

AVISO_PADRAO = "Claro! Só um instante que já vejo aqui no sistema."
AVISOS = {
    "gerar_documento": "Claro! Já estou preparando o documento, só um instante.",
    "consultar_placa": "Claro! Vou puxar os dados da placa, só um instante.",
    "anexar_foto": "Recebi! Já estou guardando a foto no sistema, só um instante.",
}
SEM_AVISO = frozenset({"quem_sou"})  # rápida e invisível para quem fala


def aviso_de_espera(tool_name: str) -> Optional[str]:
    """Frase de "um instante" para a ferramenta do sistema; None para o que não merece aviso."""
    if not (tool_name or "").startswith(TOOL_PREFIX):
        return None
    nome = tool_name[len(TOOL_PREFIX):]
    if nome in SEM_AVISO:
        return None
    return AVISOS.get(nome, AVISO_PADRAO)


# -- Humano assumiu -----------------------------------------------------------
# Quando alguem da oficina digita pelo celular num chat de cliente, o Arnaldo sai da conversa.
# Nao existe comando de liberar: o que ela digitar ali chega ao cliente, entao a conversa volta
# sozinha apos HUMANO_TTL_S sem ela digitar, ou na virada do dia (meia-noite de Brasilia).

HUMANO_TTL_S = 4 * 3600
_BRT_S = 3 * 3600  # Brasil sem horario de verao desde 2019: offset fixo -03:00


def inicio_do_dia_local(agora: float) -> float:
    """Epoch da ultima meia-noite de Brasilia (<= agora)."""
    return ((agora - _BRT_S) // 86400) * 86400 + _BRT_S


def registrar_humano(estado: dict, chat_id: str, agora: float) -> dict:
    estado[chat_id] = agora
    return estado


def humano_no_controle(estado: dict, chat_id: str, agora: float, inicio_do_dia: float) -> bool:
    t = (estado or {}).get(chat_id)
    if t is None:
        return False
    return (agora - t) < HUMANO_TTL_S and t >= inicio_do_dia


def carregar_estado(caminho: str) -> dict:
    """Le {chat: epoch}. Arquivo ausente ou corrompido => vazio (o Arnaldo atende)."""
    try:
        with open(caminho, encoding="utf-8") as fh:
            dados = json.load(fh)
        return {str(k): float(v) for k, v in dados.items()} if isinstance(dados, dict) else {}
    except Exception:
        return {}


def gravar_estado(caminho: str, estado: dict) -> None:
    """Gravacao atomica: arquivo tmp + os.replace."""
    tmp = f"{caminho}.{os.getpid()}.tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(estado, fh)
    os.replace(tmp, caminho)


# -- Grupo --------------------------------------------------------------------

def _bare_ids(ids) -> set:
    out = set()
    for raw in ids or ():
        bare = str(raw or "").split("@", 1)[0].split(":", 1)[0].strip().lower()
        if bare:
            out.add(bare)
    return out


def chamado_no_grupo(text, bot_ids, mentioned_ids, reply_to_bot: bool) -> bool:
    """Em grupo o silencio e o padrao: so responde quando chamado pelo nome ou marcado."""
    if reply_to_bot:
        return True
    body = str(text or "")
    if body.strip().startswith("/"):
        return True
    mine = _bare_ids(bot_ids)
    if mine & _bare_ids(mentioned_ids):
        return True
    low = body.lower()
    if any("@" + b in low for b in mine):
        return True
    return bool(re.search(r"\barnaldo\b", low))
