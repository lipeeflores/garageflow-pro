"""16/10: equipe passa da pausa pelo número, aviso de "um instante" e áudio depois do texto.
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

JOSE = "5547996432811"
JOSE_JID = "554796432811@s.whatsapp.net"   # no WhatsApp chega sem o 9
JOSE_LID = "111122223333444@lid"
CLIENTE_JID = "5547984889108@s.whatsapp.net"


@pytest.fixture
def casa(tmp_path, monkeypatch):
    monkeypatch.setattr(plugin, "_home", lambda: str(tmp_path))
    (tmp_path / "equipe.json").write_text(json.dumps(
        {"equipe": [{"nome": "Jose", "telefone": JOSE, "papel": "patio"}]}), encoding="utf-8")
    plugin._equipe_cache.update({"mtime": 0.0, "indice": {}, "grupos": {}})
    # @lid do José resolve para o telefone (o gateway faz isso pelos lid-mapping do bridge)
    monkeypatch.setattr(plugin, "_aliases", lambda ident: {JOSE_JID} if ident == JOSE_LID else set())
    plugin._turnos.clear()
    yield tmp_path
    plugin._vivo.update({"loop": None, "adapter": None})


def evento(chat, texto="bom dia", chat_type="dm", user=None):
    source = types.SimpleNamespace(chat_id=chat, user_id=user or chat, chat_type=chat_type, platform="whatsapp")
    return types.SimpleNamespace(source=source, text=texto, metadata={}, raw_message={}, message_type="text")


# -- pausa --------------------------------------------------------------------

def test_equipe_no_privado_passa_da_pausa_mesmo_por_lid(casa):
    assert plugin._pausa_libera(evento(JOSE_JID)) is True
    assert plugin._pausa_libera(evento(JOSE_LID, user=JOSE_LID)) is True


def test_cliente_continua_pausado(casa):
    assert plugin._pausa_libera(evento(CLIENTE_JID)) is False
    (casa / "PAUSA").write_text("em configuracao", encoding="utf-8")
    r = plugin.on_pre_gateway_dispatch(event=evento(CLIENTE_JID))
    assert r and r["action"] == "skip"


def test_equipe_em_grupo_nao_libera_o_grupo(casa):
    grupo = "120363000000000000@g.us"
    assert plugin._pausa_libera(evento(grupo, chat_type="group", user=JOSE_JID)) is False


# -- aviso de espera ------------------------------------------------------------

def test_frase_por_ferramenta():
    assert core.aviso_de_espera("mcp__oficina__gerar_documento").startswith("Claro! Já estou preparando o documento")
    assert core.aviso_de_espera("mcp__oficina__ver_os") == core.AVISO_PADRAO
    assert core.aviso_de_espera("mcp__oficina__quem_sou") is None
    assert core.aviso_de_espera("skill_view") is None
    assert core.aviso_de_espera("") is None


def test_avisos_nao_tem_valor():
    for frase in [core.AVISO_PADRAO, *core.AVISOS.values()]:
        assert not core.vaza_dinheiro(frase)


class AdapterFalso:
    def __init__(self):
        self.enviados = []

    async def send(self, chat_id, content, **kw):
        self.enviados.append((chat_id, content))


def _rodar_com_loop(casa, monkeypatch, chamadas, row=("whatsapp", "k", JOSE_JID, JOSE_LID)):
    monkeypatch.setattr(plugin, "_session_row", lambda sid: row)
    adapter = AdapterFalso()

    async def principal():
        plugin._vivo.update({"loop": asyncio.get_running_loop(), "adapter": adapter})
        for fn in chamadas:
            await asyncio.to_thread(fn)   # ganchos rodam fora do loop, como no Hermes
        await asyncio.sleep(0.05)

    asyncio.run(principal())
    return adapter.enviados


def test_aviso_sai_uma_vez_por_turno(casa, monkeypatch):
    enviados = _rodar_com_loop(casa, monkeypatch, [
        lambda: plugin._turno_comecou("s1"),
        lambda: plugin._avisar_espera("s1", "mcp__oficina__ver_os"),
        lambda: plugin._avisar_espera("s1", "mcp__oficina__gerar_documento"),
    ])
    assert enviados == [(JOSE_LID, core.AVISO_PADRAO)]
    # e passa pela trava de saída
    assert core.outbound_allowed(core.AVISO_PADRAO, plugin._approved_texts())


def test_turno_novo_avisa_de_novo(casa, monkeypatch):
    enviados = _rodar_com_loop(casa, monkeypatch, [
        lambda: plugin._turno_comecou("s1"),
        lambda: plugin._avisar_espera("s1", "mcp__oficina__ver_os"),
        lambda: plugin._turno_comecou("s1"),
        lambda: plugin._avisar_espera("s1", "mcp__oficina__consultar_placa"),
    ])
    assert [t for _, t in enviados] == [core.AVISO_PADRAO, core.AVISOS["consultar_placa"]]


def test_sem_aviso_para_quem_sou_e_para_cli(casa, monkeypatch):
    enviados = _rodar_com_loop(casa, monkeypatch, [
        lambda: plugin._turno_comecou("s1"),
        lambda: plugin._avisar_espera("s1", "mcp__oficina__quem_sou"),
    ])
    assert enviados == []
    enviados = _rodar_com_loop(casa, monkeypatch, [
        lambda: plugin._turno_comecou("s2"),
        lambda: plugin._avisar_espera("s2", "mcp__oficina__ver_os"),
    ], row=("cli", None, None, None))
    assert enviados == []


def test_ferramenta_bloqueada_nao_avisa(casa, monkeypatch):
    monkeypatch.setattr(plugin, "_identity_for_session", lambda sid: "5547984889108")  # cliente
    chamou = []
    monkeypatch.setattr(plugin, "_avisar_espera", lambda *a: chamou.append(a))
    r = plugin.on_pre_tool_call(tool_name="mcp__oficina__resumo_financeiro", args={}, session_id="s1")
    assert r["action"] == "block" and chamou == []


# -- áudio depois do texto --------------------------------------------------------

def test_audio_vai_para_segundo_plano(monkeypatch):
    monkeypatch.setattr(plugin, "_ATRASO_VOZ_S", 0.01)
    ordem = []

    class GatewayFalso:
        async def _send_voice_reply(self, event, text):
            await asyncio.sleep(0.02)
            ordem.append("audio")

    gw = GatewayFalso()
    plugin._voz_depois_do_texto(gw)
    plugin._voz_depois_do_texto(gw)  # idempotente

    async def entrega():
        await gw._send_voice_reply(None, "oi")
        ordem.append("texto")
        await asyncio.sleep(0.1)

    asyncio.run(entrega())
    assert ordem == ["texto", "audio"]


def test_audio_padrao_so_para_equipe_e_sem_sobrescrever(casa):
    plugin._vivo["adapter"] = object()
    aplicados = []

    class GatewayFalso:
        _voice_mode = {"whatsapp:ja-escolheu@lid": "off"}

        def _voice_key_for_source(self, source):
            return f"whatsapp:{source.chat_id}"

        def _apply_voice_mode(self, adapter, chave, chat_id, modo):
            self._voice_mode[chave] = modo
            aplicados.append((chave, modo))

    gw = GatewayFalso()
    plugin._voz_padrao_equipe(gw, evento(JOSE_LID).source, core.PATIO)
    plugin._voz_padrao_equipe(gw, evento(JOSE_LID).source, core.PATIO)
    plugin._voz_padrao_equipe(gw, evento(CLIENTE_JID).source, core.CLIENTE)
    plugin._voz_padrao_equipe(gw, evento("ja-escolheu@lid").source, core.DONO)
    assert aplicados == [(f"whatsapp:{JOSE_LID}", "all")]
