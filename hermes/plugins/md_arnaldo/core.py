"""Pure decision logic for the md_arnaldo plugin (no Hermes imports, unit-testable)."""
from __future__ import annotations

import hashlib
import hmac
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

DEBOUNCE_EQUIPE = 4.0
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
_DINHEIRO = re.compile(
    r"(r\$\s*\d)"
    r"|(\d[\d.,]*\s*(?:reais|contos|mil\s+reais))"
    r"|(\d[\d.,]*\s*%)"
    r"|(\bmargem\b)|(\blucro\b)|(\bfaturamento\b)|(\bor[çc]amento\b)|(\bdesconto\b)",
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
