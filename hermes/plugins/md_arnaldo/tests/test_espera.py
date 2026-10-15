"""espera.py — recado picado do cliente vira um turno so, e a resposta SAI (adapter.handle_message).

Arquivo identico em md_arnaldo/tests/test_espera.py.
"""
import asyncio
import dataclasses
import json
import logging
import os
import sys
from enum import Enum
from typing import Any, Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import espera  # noqa: E402


class Plat(Enum):
    WHATSAPP = "whatsapp"


class Tipo(Enum):
    TEXT = "text"
    PHOTO = "photo"


@dataclasses.dataclass
class Src:
    chat_id: str = "5547@lid"
    user_id: str = "5547@s.whatsapp.net"
    platform: Plat = Plat.WHATSAPP
    chat_type: str = "dm"


@dataclasses.dataclass
class Ev:
    text: str
    message_type: Tipo = Tipo.TEXT
    source: Src = dataclasses.field(default_factory=Src)
    metadata: Optional[dict] = None


class Adapter:
    def __init__(self):
        self.recebidos = []

    async def handle_message(self, event):
        self.recebidos.append(event)


class Gateway:
    def __init__(self):
        self.adapters = {Plat.WHATSAPP: Adapter()}

    async def _handle_message(self, event):  # porta errada: nunca deve ser usada
        raise AssertionError("soltou pela porta que NAO envia a resposta")


def _espera(tmp_path, teto=60.0):
    return espera.Espera("teste", logging.getLogger("t"), lambda: str(tmp_path), teto=teto)


def test_juntar_textos():
    assert espera.juntar_textos(["oi", "  ", "tudo bem?", "tudo bem?", "quero uma lancha"]) == \
        "oi\ntudo bem?\nquero uma lancha"


def test_recado_picado_vira_um_turno_pela_porta_que_envia(tmp_path):
    async def cenario():
        gw, es = Gateway(), _espera(tmp_path)
        for parte in ("oi", "tudo bem?", "quero uma lancha pra sabado"):
            assert es.segurar("k", Ev(parte), gw, 0.15) is True
            await asyncio.sleep(0.05)  # cliente digitando: relogio reinicia
        assert gw.adapters[Plat.WHATSAPP].recebidos == []
        await asyncio.sleep(0.3)
        return gw.adapters[Plat.WHATSAPP].recebidos

    recebidos = asyncio.run(cenario())
    assert len(recebidos) == 1
    assert recebidos[0].text == "oi\ntudo bem?\nquero uma lancha pra sabado"
    assert espera.ja_liberado(recebidos[0])


def test_texto_reescrito_pelo_plugin_e_o_que_vai(tmp_path):
    async def cenario():
        gw, es = Gateway(), _espera(tmp_path)
        es.segurar("k", Ev("/new"), gw, 0.05, texto="[comando neutralizado] new")
        await asyncio.sleep(0.15)
        return gw.adapters[Plat.WHATSAPP].recebidos

    assert asyncio.run(cenario())[0].text == "[comando neutralizado] new"


def test_foto_solta_o_texto_pendente_na_hora(tmp_path):
    async def cenario():
        gw, es = Gateway(), _espera(tmp_path)
        es.segurar("k", Ev("olha essa lancha"), gw, 30.0)
        es.soltar_agora("k")
        await asyncio.sleep(0.05)
        return gw.adapters[Plat.WHATSAPP].recebidos, es.pendentes()

    recebidos, pend = asyncio.run(cenario())
    assert [e.text for e in recebidos] == ["olha essa lancha"] and pend == 0


def test_teto_atende_quem_nunca_para_de_digitar(tmp_path):
    async def cenario():
        gw, es = Gateway(), _espera(tmp_path, teto=0.3)
        for i in range(8):
            es.segurar("k", Ev(f"parte {i}"), gw, 0.2)
            await asyncio.sleep(0.06)
        await asyncio.sleep(0.05)
        return gw.adapters[Plat.WHATSAPP].recebidos

    recebidos = asyncio.run(cenario())
    assert len(recebidos) >= 1  # saiu antes do cliente parar


def test_conversas_diferentes_nao_se_misturam(tmp_path):
    async def cenario():
        gw, es = Gateway(), _espera(tmp_path)
        es.segurar("a", Ev("oi da Ana"), gw, 0.05)
        es.segurar("b", Ev("oi do Beto"), gw, 0.05)
        await asyncio.sleep(0.15)
        return sorted(e.text for e in gw.adapters[Plat.WHATSAPP].recebidos)

    assert asyncio.run(cenario()) == ["oi da Ana", "oi do Beto"]


def test_sem_loop_nao_segura(tmp_path):
    assert _espera(tmp_path).segurar("k", Ev("oi"), Gateway(), 1.0) is False


def test_sem_adapter_nao_segura(tmp_path):
    async def cenario():
        gw = Gateway()
        gw.adapters = {}
        return _espera(tmp_path).segurar("k", Ev("oi"), gw, 1.0)

    assert asyncio.run(cenario()) is False


def test_entrega_que_falha_fica_gravada(tmp_path):
    class Quebrado(Adapter):
        async def handle_message(self, event):
            raise RuntimeError("bridge caiu")

    async def cenario():
        gw, es = Gateway(), _espera(tmp_path)
        gw.adapters = {Plat.WHATSAPP: Quebrado()}
        es.segurar("k", Ev("quero reservar"), gw, 0.02)
        await asyncio.sleep(0.1)

    asyncio.run(cenario())
    linha = json.loads((tmp_path / "espera-perdidas.jsonl").read_text(encoding="utf-8").strip())
    assert linha["textos"] == ["quero reservar"] and "bridge caiu" in linha["motivo"]


def test_eh_texto():
    assert espera.eh_texto(Ev("oi"))
    assert not espera.eh_texto(Ev("", Tipo.TEXT))
    assert not espera.eh_texto(Ev("legenda", Tipo.PHOTO))
