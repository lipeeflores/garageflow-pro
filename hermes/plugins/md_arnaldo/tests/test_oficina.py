"""Ferramentas `oficina`: identidade assinada (HMAC) e barreira por papel.
Rodar: python -m pytest tests -q (dentro de plugins/md_arnaldo)."""
import hashlib
import hmac
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from md_arnaldo import core

SEGREDO = "s3gr3d0"
CLIENTE = "5547984889108"
PREFIXO = "mcp__oficina__"


def _decide(tool, args=None, identity=CLIENTE, papel=core.CLIENTE, secret=SEGREDO, now_ms=1_000_000):
    return core.decide_tool_call(tool, args or {}, "sess1", identity, papel, secret, now_ms)


def test_assinatura_bate_com_o_vetor_fixo_da_api():
    # Mesmo valor do teste vitest src/test/arnaldo/puros.test.ts: garante que os dois lados assinam igual.
    assert core.sign(CLIENTE, "sess1", 1_000_000, SEGREDO) == (
        "11f0e64ac3ecbd039886d7218c15db06d30f53801bbccd2acd206744a9b7056e"
    )
    esperado = hmac.new(b"s3gr3d0", b"5547984889108|sess1|1000000", hashlib.sha256).hexdigest()
    assert core.caller_envelope(CLIENTE, "sess1", SEGREDO, now_ms=1_000_000) == {
        "phone": CLIENTE, "session_id": "sess1", "ts": 1_000_000, "sig": esperado,
    }


def test_cliente_agenda_com_chamador_assinado():
    d = _decide(PREFIXO + "agendar", {"placa": "ABC1D23", "inicio": "2026-10-20T09:00:00-03:00", "motivo": "freio"})
    assert d["action"] == "modify"
    caller = d["args"]["caller"]
    assert caller["phone"] == CLIENTE
    assert caller["session_id"] == "sess1"
    assert caller["sig"] == core.sign(CLIENTE, "sess1", caller["ts"], SEGREDO)
    assert d["args"]["placa"] == "ABC1D23"  # args do modelo preservados


def test_cliente_nao_abre_os():
    d = _decide(PREFIXO + "abrir_os", {"placa": "ABC1D23", "queixa": "x"})
    assert d["action"] == "block"
    assert "equipe" in d["message"]


def test_cliente_so_chama_as_ferramentas_de_cliente():
    for nome in core.CLIENT_TOOLS:
        assert _decide(PREFIXO + nome)["action"] == "modify", nome
    for nome in ("agenda_do_dia", "buscar", "ver_os", "abrir_os", "registrar_checkin", "anexar_foto",
                 "registrar_diagnostico", "adicionar_itens", "mover_etapa", "atribuir",
                 "precificar_itens", "enviar_orcamento", "registrar_pagamento", "resumo_financeiro",
                 "contas_a_pagar", "ferramenta_inventada"):
        assert _decide(PREFIXO + nome)["action"] == "block", nome


def test_cliente_pode_consultar_placa_e_gerar_documento_com_chamador_assinado():
    for nome in ("consultar_placa", "gerar_documento"):
        assert nome in core.CLIENT_TOOLS
        d = _decide(PREFIXO + nome, {"tipo": "orcamento", "numero": 42, "caller": {"phone": "5547999990001"}})
        assert d["action"] == "modify", nome
        caller = d["args"]["caller"]
        assert caller["phone"] == CLIENTE  # o do chamador de verdade, nunca o que o modelo mandou
        assert caller["sig"] == core.sign(CLIENTE, "sess1", caller["ts"], SEGREDO)
        assert d["args"]["tipo"] == "orcamento"


def test_patio_abre_os():
    d = _decide(PREFIXO + "abrir_os", {"placa": "ABC1D23", "queixa": "barulho"}, identity="5547999990003", papel=core.PATIO)
    assert d["action"] == "modify"
    assert d["args"]["caller"]["phone"] == "5547999990003"


def test_caller_injetado_pelo_modelo_e_substituido():
    falso = {"phone": "5547999990001", "session_id": "x", "ts": 1, "sig": "forjada"}
    d = _decide(PREFIXO + "meus_dados", {"caller": falso})
    assert d["action"] == "modify"
    assert d["args"]["caller"]["phone"] == CLIENTE
    assert d["args"]["caller"]["sig"] != "forjada"


def test_cron_assina_como_system():
    d = _decide(PREFIXO + "agenda_do_dia", identity=core.SYSTEM, papel=core.GESTAO)
    assert d["action"] == "modify"
    assert d["args"]["caller"]["phone"] == "SYSTEM"


def test_terminal_e_bloqueado_para_qualquer_papel():
    for papel in (core.CLIENTE, core.PATIO, core.GESTAO, core.DONO):
        assert _decide("terminal", papel=papel)["action"] == "block"
        assert _decide("execute_code", papel=papel)["action"] == "block"


def test_builtins_de_leitura_passam():
    assert _decide("skills_list")["action"] == "allow"
    assert _decide("skills_list", identity=None, papel=core.DESCONHECIDO)["action"] == "allow"


def test_identidade_desconhecida_bloqueia():
    d = _decide(PREFIXO + "meus_dados", identity=None, papel=core.DESCONHECIDO)
    assert d["action"] == "block"


def test_sem_segredo_bloqueia():
    assert _decide(PREFIXO + "meus_dados", secret="")["action"] == "block"


def test_papel_desconhecido_nao_vira_equipe():
    assert _decide(PREFIXO + "abrir_os", papel=core.DESCONHECIDO)["action"] == "block"


def test_modo_de_teste_so_vale_no_cli_com_a_flag():
    sem_alias = lambda _: []
    assert core.resolve_identity("cli", None, None, None, sem_alias, True, "47 8488-9108") == CLIENTE
    assert core.resolve_identity("cli", None, None, None, sem_alias, True, "SYSTEM") == core.SYSTEM
    assert core.resolve_identity("cli", None, None, None, sem_alias, False, "47 8488-9108") is None
    assert core.resolve_identity("whatsapp", None, None, None, sem_alias, True, "47 8488-9108") is None
    assert core.resolve_identity("cli", None, None, None, sem_alias) is None
