"""Testes da lógica pura do md_arnaldo. Rodar: python -m pytest tests -q (dentro de plugins/md_arnaldo)."""
from datetime import datetime
from zoneinfo import ZoneInfo

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from md_arnaldo import core


EQUIPE = core.equipe_index([
    {"nome": "Simone", "telefone": "5547999990001", "papel": "gestao"},
    {"nome": "Marcio", "telefone": "47999990002", "papel": "dono"},
    {"nome": "Joao", "telefone": "5547999990003", "papel": "patio"},
    {"nome": "sem numero", "telefone": "", "papel": "dono"},
])


def test_telefone_normaliza_e_ignora_lid():
    assert core.normalize_br_phone("47999990002") == "5547999990002"
    assert core.normalize_br_phone("5547 99999-0002") == "5547999990002"
    assert core.normalize_br_phone("554799990002") == "5547999990002"  # 8 digitos, entra o nono
    assert core.normalize_br_phone("231296907366514@lid") is None
    assert core.normalize_br_phone("") is None


def test_equipe_ignora_telefone_invalido():
    assert len(EQUIPE) == 3


def test_papel_pelo_numero():
    assert core.papel_de("5547999990001", EQUIPE) == core.GESTAO
    assert core.papel_de("5547999990002", EQUIPE) == core.DONO
    assert core.papel_de("5547999990003", EQUIPE) == core.PATIO
    assert core.papel_de("5547988887777", EQUIPE) == core.CLIENTE
    assert core.papel_de(None, EQUIPE) == core.DESCONHECIDO
    assert core.papel_de(core.SYSTEM, EQUIPE) == core.GESTAO


def test_so_dono_e_gestao_veem_dinheiro():
    assert core.ve_dinheiro(core.DONO)
    assert core.ve_dinheiro(core.GESTAO)
    assert not core.ve_dinheiro(core.PATIO)
    assert not core.ve_dinheiro(core.CLIENTE)
    assert not core.ve_dinheiro(core.DESCONHECIDO)


GRUPOS = core.grupos_index({
    "120363000000000001@g.us": {"nome": "MD Donos", "financeiro": True},
    "120363000000000002@g.us": {"nome": "Patio MD", "financeiro": False},
})


def test_grupo_financeiro_so_quando_declarado():
    # dono no grupo dos donos: pode falar valor
    assert core.ve_dinheiro_na_conversa(core.DONO, "120363000000000001@g.us", GRUPOS)
    # o MESMO dono no grupo do patio: nao pode, porque o mecanico le junto
    assert not core.ve_dinheiro_na_conversa(core.DONO, "120363000000000002@g.us", GRUPOS)
    # grupo que ninguem cadastrou: sigilo ligado
    assert not core.ve_dinheiro_na_conversa(core.DONO, "120363000000000009@g.us", GRUPOS)
    # DM do dono continua liberada
    assert core.ve_dinheiro_na_conversa(core.DONO, None, GRUPOS)
    # cliente nao ve valor em lugar nenhum, nem no grupo dos donos
    assert not core.ve_dinheiro_na_conversa(core.CLIENTE, "120363000000000001@g.us", GRUPOS)


def test_filtro_usa_a_plateia_e_nao_so_o_falante():
    texto, vazou = core.filtrar_saida("Fica R$ 1.200 o serviço.", core.DONO,
                                      "120363000000000002@g.us", GRUPOS)
    assert vazou and texto == core.RECUSA_SIGILO
    texto, vazou = core.filtrar_saida("Fica R$ 1.200 o serviço.", core.DONO,
                                      "120363000000000001@g.us", GRUPOS)
    assert not vazou and "1.200" in texto


def test_jid_do_grupo_sai_da_chave_de_sessao():
    assert core.grupo_from_session_key("a:whatsapp:group:120363000000000001@g.us:5547999990001") == "120363000000000001@g.us"
    assert core.grupo_from_session_key("a:whatsapp:dm:5547999990001") is None


def test_contexto_de_grupo_avisa_a_plateia():
    agora = datetime(2026, 9, 21, 10, 0, tzinfo=ZoneInfo("America/Sao_Paulo"))
    ctx = core.turn_context("5547999990002", EQUIPE, agora, "120363000000000002@g.us", GRUPOS)
    assert "GRUPO (Patio MD)" in ctx and "todo mundo do grupo le" in ctx
    assert "SIGILO FINANCEIRO ATIVO" in ctx and "nao e o canal financeiro" in ctx
    ctx = core.turn_context("5547999990002", EQUIPE, agora, "120363000000000001@g.us", GRUPOS)
    assert "GRUPO (MD Donos)" in ctx and "SIGILO FINANCEIRO" not in ctx


def test_contexto_avisa_sigilo_para_quem_nao_ve_dinheiro():
    agora = datetime(2026, 9, 21, 14, 5, tzinfo=ZoneInfo("America/Sao_Paulo"))
    patio = core.turn_context("5547999990003", EQUIPE, agora)
    assert "PATIO/MECANICO — Joao" in patio
    assert "SIGILO FINANCEIRO ATIVO" in patio
    assert "21/09/2026" in patio and "14h05" in patio
    dona = core.turn_context("5547999990001", EQUIPE, agora)
    assert "GESTAO/FINANCEIRO — Simone" in dona
    assert "SIGILO FINANCEIRO" not in dona


def test_debounce_por_papel():
    assert core.debounce_seconds(core.CLIENTE) == 30.0
    assert core.debounce_seconds(core.DESCONHECIDO) == 30.0
    assert core.debounce_seconds(core.PATIO) == 4.0
    assert core.debounce_seconds(core.GESTAO) == 4.0


def test_juntar_textos_sem_repetir():
    assert core.juntar_textos(["oi", " ", "oi", "meu carro"]) == "oi\nmeu carro"
    assert core.juntar_textos([]) == ""


def test_filtro_de_dinheiro_troca_a_resposta_do_patio():
    texto, vazou = core.filtrar_saida("A pastilha sai por R$ 380 no total.", core.PATIO)
    assert vazou and texto == core.RECUSA_SIGILO
    texto, vazou = core.filtrar_saida("A margem desse serviço é 40%.", core.PATIO)
    assert vazou
    texto, vazou = core.filtrar_saida("Troca de pastilha e disco dianteiro, 2 horas de box.", core.PATIO)
    assert not vazou and "pastilha" in texto
    texto, vazou = core.filtrar_saida("Fica R$ 380 no total.", core.GESTAO)
    assert not vazou and "380" in texto


def test_dinheiro_nao_pega_quilometragem():
    assert not core.vaza_dinheiro("O carro entrou com 145.000 km e meio tanque.")
    assert core.vaza_dinheiro("orçamento aprovado")
    assert core.vaza_dinheiro("450 reais")


def test_sanitize_tira_markdown():
    assert core.sanitize_whatsapp("**Ordem** de serviço") == "Ordem de serviço"
    assert core.sanitize_whatsapp("## Título\n---\ntexto") == "Título\n\ntexto"


def test_trava_de_saida():
    aprovados = ["Bom dia, seu Márcio! O Gol já está no elevador 2."]
    assert core.outbound_allowed("Bom dia, seu Márcio!", aprovados)
    assert core.outbound_allowed("O Gol já está no elevador 2.", aprovados)
    assert not core.outbound_allowed("⚠️ Gateway reiniciando, tente de novo.", aprovados)
    assert core.outbound_allowed("", aprovados)


def test_texto_final_tem_que_vir_do_modelo():
    assert core.is_model_derived("Bom dia!", ["**Bom dia!**"])
    assert not core.is_model_derived("Erro de provedor: rate limit", ["Bom dia!"])


def test_comando_barra_vira_texto():
    assert core.neutralize_command("/reset") == "reset"
    assert core.neutralize_command("/") == "oi"
    assert core.neutralize_command("bom dia") is None


def test_grupo_so_responde_quando_chamado():
    assert core.chamado_no_grupo("Arnaldo, o Gol ficou pronto?", [], [], False)
    assert core.chamado_no_grupo("pode ver isso?", ["5547999@s.whatsapp.net"], ["5547999:12@s.whatsapp.net"], False)
    assert core.chamado_no_grupo("qualquer coisa", [], [], True)
    assert not core.chamado_no_grupo("almoço chegou", [], [], False)


def test_ferramentas_so_leitura_e_oficina():
    # Detalhes (assinatura, papeis) em test_oficina.py.
    ident = "5547999990001"
    assert core.decide_tool_call("skills_list", {}, "s", ident, core.GESTAO, "k")["action"] == "allow"
    assert core.decide_tool_call("execute_code", {}, "s", ident, core.GESTAO, "k")["action"] == "block"
    assert core.decide_tool_call("mcp__oficina__ver_os", {}, "s", ident, core.GESTAO, "k")["action"] == "modify"


def test_identidade_vem_da_chave_de_sessao():
    assert core.phone_from_session_key("abc:whatsapp:dm:5547999990001") == "5547999990001"
    assert core.phone_from_session_key("abc:whatsapp:group:12036@g.us:5547999990003") == "5547999990003"
    assert core.phone_from_session_key("abc:cli:local") is None
