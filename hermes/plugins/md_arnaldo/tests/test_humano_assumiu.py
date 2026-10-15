"""B3: quando alguém da oficina digita pelo celular, o Arnaldo sai da conversa.
Rodar: python -m pytest tests -q (dentro de plugins/md_arnaldo)."""
import asyncio
import json
import os
import sys
import types

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import md_arnaldo as plugin
from md_arnaldo import core

CHAT = "5547984889108@s.whatsapp.net"
TTL = core.HUMANO_TTL_S
# 2026-10-20 12:00 BRT = 15:00 UTC
AGORA = 1_792_508_400.0
MEIA_NOITE = core.inicio_do_dia_local(AGORA)


# -- funcoes puras ------------------------------------------------------------

def test_inicio_do_dia_e_meia_noite_de_brasilia():
    assert MEIA_NOITE == AGORA - 12 * 3600
    assert core.inicio_do_dia_local(MEIA_NOITE) == MEIA_NOITE
    assert core.inicio_do_dia_local(MEIA_NOITE - 1) == MEIA_NOITE - 86400


def test_humano_vale_por_4_horas():
    estado = core.registrar_humano({}, CHAT, AGORA - 3600)
    assert core.humano_no_controle(estado, CHAT, AGORA, MEIA_NOITE) is True
    assert core.humano_no_controle(estado, CHAT, AGORA - 3600 + TTL - 1, MEIA_NOITE) is True
    assert core.humano_no_controle(estado, CHAT, AGORA - 3600 + TTL, MEIA_NOITE) is False
    assert core.humano_no_controle(estado, "outro@s.whatsapp.net", AGORA, MEIA_NOITE) is False
    assert core.humano_no_controle({}, CHAT, AGORA, MEIA_NOITE) is False


def test_registro_de_ontem_nao_vale_hoje():
    ontem = MEIA_NOITE - 600  # 23h50 de ontem
    estado = core.registrar_humano({}, CHAT, ontem)
    assert core.humano_no_controle(estado, CHAT, MEIA_NOITE + 60, MEIA_NOITE) is False


def test_cada_mensagem_dela_renova_o_prazo():
    estado = core.registrar_humano({}, CHAT, AGORA - TTL + 60)  # quase vencendo
    assert core.humano_no_controle(estado, CHAT, AGORA, MEIA_NOITE) is True
    estado = core.registrar_humano(estado, CHAT, AGORA - 10)
    assert core.humano_no_controle(estado, CHAT, AGORA + TTL - 20, MEIA_NOITE) is True


def test_estado_grava_e_le_do_arquivo(tmp_path):
    caminho = str(tmp_path / "humano-assumiu.json")
    assert core.carregar_estado(caminho) == {}
    core.gravar_estado(caminho, {CHAT: AGORA})
    assert core.carregar_estado(caminho) == {CHAT: AGORA}
    assert not [f for f in os.listdir(tmp_path) if f.endswith(".tmp")]
    (tmp_path / "humano-assumiu.json").write_text("{lixo", encoding="utf-8")
    assert core.carregar_estado(caminho) == {}


# -- embrulho do adapter ------------------------------------------------------

class AdapterFalso:
    def __init__(self):
        self.recebidas = []
        self.name = "whatsapp"

    async def send(self, chat_id, content, reply_to=None, metadata=None, **kw):
        return None

    async def handle_message(self, event):
        self.recebidas.append(event)


def evento(texto="oi", chat=CHAT, dono=False, user="5547984889108@s.whatsapp.net", chat_type="dm"):
    source = types.SimpleNamespace(chat_id=chat, user_id=user, chat_type=chat_type, platform="whatsapp")
    md = {"whatsapp_from_owner": True} if dono else {}
    return types.SimpleNamespace(source=source, text=texto, metadata=md, message_type="text")


@pytest.fixture
def casa(tmp_path, monkeypatch):
    monkeypatch.setattr(plugin, "_home", lambda: str(tmp_path))
    (tmp_path / "equipe.json").write_text(json.dumps({"equipe": [
        {"nome": "Simone", "telefone": "5547999990001", "papel": "gestao"},
        {"nome": "Joao", "telefone": "5547999990003", "papel": "patio"},
    ]}), encoding="utf-8")
    plugin._humano_reset_para_teste()
    return tmp_path


def instalar():
    ad = AdapterFalso()
    plugin._guard_adapter(ad)
    return ad


def rodar(ad, ev):
    asyncio.run(ad.handle_message(ev))


def linhas(caminho):
    if not os.path.exists(caminho):
        return []
    return [json.loads(x) for x in open(caminho, encoding="utf-8").read().splitlines() if x.strip()]


def test_mensagem_do_dono_nunca_vira_turno(casa):
    ad = instalar()
    rodar(ad, evento("pode vir amanha as 9", dono=True))
    assert ad.recebidas == []
    aud = linhas(str(casa / "humano-auditoria.jsonl"))
    assert [a["tipo"] for a in aud] == ["humano_assumiu"]
    assert "humano-assumiu.json" in os.listdir(casa)


def test_cliente_em_chat_com_humano_nao_chama_o_original(casa):
    ad = instalar()
    rodar(ad, evento("pode vir amanha as 9", dono=True))
    rodar(ad, evento("tá bom, obrigado"))
    assert ad.recebidas == []
    aud = linhas(str(casa / "humano-auditoria.jsonl"))
    assert [a["tipo"] for a in aud] == ["humano_assumiu", "silencio_humano"]
    feed = linhas(str(casa / "humano-feed.jsonl"))
    assert len(feed) == 1 and feed[0]["texto"] == "tá bom, obrigado" and feed[0]["chat"] == CHAT


def test_cliente_de_outro_chat_segue_normal(casa):
    ad = instalar()
    rodar(ad, evento("x", dono=True))
    outro = evento("oi", chat="5547988887777@s.whatsapp.net", user="5547988887777@s.whatsapp.net")
    rodar(ad, outro)
    assert ad.recebidas == [outro]


def test_cliente_sem_humano_passa(casa):
    ad = instalar()
    ev = evento("preciso de um orçamento")
    rodar(ad, ev)
    assert ad.recebidas == [ev]


def test_equipe_nunca_entra_no_humano_no_controle(casa):
    ad = instalar()
    simone = "5547999990001@s.whatsapp.net"
    # Alguém digita pelo celular da oficina no chat da Simone; a Simone falando com o Arnaldo passa.
    rodar(ad, evento("oi", chat=simone, user=simone, dono=True))
    ev = evento("o que tem hoje?", chat=simone, user=simone)
    rodar(ad, ev)
    assert ad.recebidas == [ev]


def test_grupo_nao_se_aplica(casa):
    ad = instalar()
    ev = evento("oi", chat="1203@g.us", chat_type="group")
    rodar(ad, ev)
    assert ad.recebidas == [ev]


def test_volta_sozinho_depois_de_4h(casa, monkeypatch):
    ad = instalar()
    relogio = {"t": AGORA}
    monkeypatch.setattr(plugin.time, "time", lambda: relogio["t"])
    rodar(ad, evento("x", dono=True))
    relogio["t"] = AGORA + TTL - 5
    rodar(ad, evento("ainda aqui?"))
    assert ad.recebidas == []
    relogio["t"] = AGORA + TTL + 5
    ev = evento("e agora?")
    rodar(ad, ev)
    assert ad.recebidas == [ev]


def test_estado_sobrevive_a_reinicio(casa):
    ad = instalar()
    rodar(ad, evento("x", dono=True))
    plugin._humano_reset_para_teste()  # simula processo novo: memoria vazia, arquivo fica
    ad2 = instalar()
    rodar(ad2, evento("oi"))
    assert ad2.recebidas == []


def test_falha_no_filtro_ainda_descarta_mensagem_do_dono(casa, monkeypatch):
    ad = instalar()
    monkeypatch.setattr(plugin.core, "registrar_humano", lambda *a, **k: 1 / 0)
    rodar(ad, evento("x", dono=True))
    assert ad.recebidas == []


def test_embrulho_e_idempotente(casa):
    ad = AdapterFalso()
    plugin._guard_adapter(ad)
    primeiro = ad.handle_message
    plugin._guard_adapter(ad)
    assert ad.handle_message is primeiro
