"""16/10: a lista do virada_do_dia se mantém sozinha (equipe e grupo financeiro; cliente fora).
Rodar: python -m pytest tests -q (dentro de plugins/md_arnaldo)."""
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import md_arnaldo as plugin
from md_arnaldo import core

GERENCIA = "120363431457941743@g.us"
GRUPOS = {GERENCIA: {"nome": "MD Gerência", "financeiro": True}, "1203@g.us": {"nome": "outro"}}
MARCIO_KEY = "agent:main:whatsapp:dm:554784889097"


def test_quem_entra():
    assert core.deve_virar("whatsapp", MARCIO_KEY, core.DONO, None, GRUPOS)
    assert core.deve_virar("whatsapp", MARCIO_KEY, core.PATIO, None, GRUPOS)
    assert not core.deve_virar("whatsapp", MARCIO_KEY, core.CLIENTE, None, GRUPOS)
    assert not core.deve_virar("cli", MARCIO_KEY, core.DONO, None, GRUPOS)
    assert not core.deve_virar("whatsapp", None, core.DONO, None, GRUPOS)
    # grupo: vale a plateia, não quem fala
    k = f"agent:main:whatsapp:group:{GERENCIA}:556799090751"
    assert core.deve_virar("whatsapp", k, core.CLIENTE, GERENCIA, GRUPOS)
    assert not core.deve_virar("whatsapp", k, core.DONO, "1203@g.us", GRUPOS)


def test_inscrever_cria_com_padrao_e_nao_duplica():
    cfg, mudou = core.inscrever_virada(None, MARCIO_KEY, "Marcio Couto")
    assert mudou and cfg["agente"] == "Arnaldo" and cfg["hora"] == "03:30"
    assert cfg["conversas"] == {MARCIO_KEY: "Marcio Couto"}
    cfg2, mudou2 = core.inscrever_virada(cfg, MARCIO_KEY, "Outro nome")
    assert not mudou2 and cfg2["conversas"][MARCIO_KEY] == "Marcio Couto"


def test_inscrever_preserva_o_que_ja_existe():
    atual = {"hora": "04:00", "ate": "05:00", "agente": "Arnaldo", "conversas": {"x": "Simone"}}
    cfg, mudou = core.inscrever_virada(atual, MARCIO_KEY, "")
    assert mudou and cfg["hora"] == "04:00" and cfg["conversas"] == {"x": "Simone", MARCIO_KEY: "Equipe"}
    assert atual["conversas"] == {"x": "Simone"}  # não muda o dicionário de quem chamou


@pytest.fixture
def casa(tmp_path, monkeypatch):
    monkeypatch.setattr(plugin, "_home", lambda: str(tmp_path))
    monkeypatch.setattr(plugin, "_grupos", lambda: GRUPOS)
    return tmp_path


def test_plugin_grava_virada_json_para_a_equipe(casa, monkeypatch):
    monkeypatch.setattr(plugin, "_session_row", lambda sid: ("whatsapp", MARCIO_KEY, "u", "c@lid"))
    indice = {"5547984889097": {"nome": "Marcio Couto", "papel": core.DONO}}
    plugin._inscrever_na_virada("s1", "5547984889097", None, indice)
    plugin._inscrever_na_virada("s1", "5547984889097", None, indice)
    dados = json.loads((casa / "virada.json").read_text(encoding="utf-8"))
    assert dados["conversas"] == {MARCIO_KEY: "Marcio Couto"}


def test_plugin_nao_grava_cliente(casa, monkeypatch):
    monkeypatch.setattr(plugin, "_session_row", lambda sid: ("whatsapp", "agent:main:whatsapp:dm:5547999990001", "u", "c"))
    plugin._inscrever_na_virada("s1", "5547999990001", None, {})
    assert not (casa / "virada.json").exists()


def test_virada_json_quebrado_fica_como_esta(casa, monkeypatch):
    (casa / "virada.json").write_text("{quebrado", encoding="utf-8")
    monkeypatch.setattr(plugin, "_session_row", lambda sid: ("whatsapp", MARCIO_KEY, "u", "c"))
    plugin._inscrever_na_virada("s1", "5547984889097", None, {"5547984889097": {"nome": "M", "papel": core.DONO}})
    assert (casa / "virada.json").read_text(encoding="utf-8") == "{quebrado"
