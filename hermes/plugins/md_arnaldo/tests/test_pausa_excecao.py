"""PAUSA_EXCETO: o Arnaldo pode ficar ativo só em chats listados enquanto o resto segue pausado.
Rodar: python -m pytest tests -q (dentro de plugins/md_arnaldo)."""
import os
import sys
import types

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import md_arnaldo as plugin

GRUPO = "120363431457941743@g.us"
OUTRO_GRUPO = "120363000000000000@g.us"
CLIENTE = "5547984889108@s.whatsapp.net"


def evento(chat, texto="arnaldo, quem vem hoje?", chat_type="group"):
    source = types.SimpleNamespace(chat_id=chat, user_id="5547999990001@s.whatsapp.net", chat_type=chat_type, platform="whatsapp")
    return types.SimpleNamespace(source=source, text=texto, metadata={}, raw_message={}, message_type="text")


@pytest.fixture
def casa(tmp_path, monkeypatch):
    monkeypatch.setattr(plugin, "_home", lambda: str(tmp_path))
    return tmp_path


def test_sem_arquivo_ninguem_e_liberado(casa):
    assert plugin._pausa_libera(evento(GRUPO)) is False


def test_so_o_chat_listado_e_liberado(casa):
    (casa / "PAUSA_EXCETO").write_text(f"# grupo da gerencia\n{GRUPO}\n\n", encoding="utf-8")
    assert plugin._pausa_libera(evento(GRUPO)) is True
    assert plugin._pausa_libera(evento(OUTRO_GRUPO)) is False
    assert plugin._pausa_libera(evento(CLIENTE, chat_type="dm")) is False


def test_comentario_e_linha_vazia_nao_liberam_nada(casa):
    (casa / "PAUSA_EXCETO").write_text("# " + GRUPO + "\n\n   \n", encoding="utf-8")
    assert plugin._pausa_libera(evento(GRUPO)) is False
    assert plugin._pausa_libera(evento("")) is False


def test_evento_sem_origem_nao_quebra_e_nao_libera(casa):
    (casa / "PAUSA_EXCETO").write_text(GRUPO + "\n", encoding="utf-8")
    assert plugin._pausa_libera(types.SimpleNamespace()) is False
    assert plugin._pausa_libera(None) is False


def test_dispatch_com_pausa_so_deixa_passar_o_chat_liberado(casa):
    (casa / "PAUSA").write_text("em configuracao", encoding="utf-8")
    (casa / "PAUSA_EXCETO").write_text(GRUPO + "\n", encoding="utf-8")

    # DM de cliente e outro grupo continuam pausados.
    r = plugin.on_pre_gateway_dispatch(event=evento(CLIENTE, "oi", chat_type="dm"))
    assert r and r["action"] == "skip" and "em configuracao" in r["reason"]
    r = plugin.on_pre_gateway_dispatch(event=evento(OUTRO_GRUPO))
    assert r and r["action"] == "skip" and "em configuracao" in r["reason"]

    # O grupo liberado passa da pausa (chamado pelo nome, então segue para o agente).
    assert plugin.on_pre_gateway_dispatch(event=evento(GRUPO)) is None
    # Ainda vale a regra de grupo: sem chamar o Arnaldo, silêncio (e não por causa da pausa).
    r = plugin.on_pre_gateway_dispatch(event=evento(GRUPO, "bom dia pessoal"))
    assert r and r["action"] == "skip" and "ninguem chamou" in r["reason"]


def test_sem_excecao_a_pausa_vale_para_todos(casa):
    (casa / "PAUSA").write_text("em configuracao", encoding="utf-8")
    r = plugin.on_pre_gateway_dispatch(event=evento(GRUPO))
    assert r and r["action"] == "skip" and "em configuracao" in r["reason"]
