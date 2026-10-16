"""16/10: papel pelo cadastro do garageflow (quem_sou da arnaldo-api), com o equipe.json de reforço.
Rodar: python -m pytest tests -q (dentro de plugins/md_arnaldo)."""
import asyncio
import inspect
import io
import json
import logging
import os
import sys
import threading
import time
import types

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import md_arnaldo as plugin
from md_arnaldo import cadastro, core

LOG = logging.getLogger("teste-cadastro")
JOSE = "5547996432811"          # no equipe.json como pátio
NOVO = "5547991112222"          # mecânico cadastrado SÓ no garageflow
NOVO_JID = "554791112222@s.whatsapp.net"
CLIENTE = "5547984889108"
SIMONE = "5547984889113"        # no equipe.json como dona


def ok(papel, nome=None):
    dados = {"papel": papel, "ve_dinheiro": papel in ("dono", "gestao")}
    if nome:
        dados["nome"] = nome
    return {"ok": True, "dados": dados}


# -- resposta do quem_sou -------------------------------------------------------

def test_le_a_resposta_do_quem_sou():
    assert core.papel_do_sistema(ok("patio", "Novo Mecânico")) == {"papel": "patio", "nome": "Novo Mecânico"}
    assert core.papel_do_sistema(ok("cliente")) == {"papel": "cliente", "nome": ""}


@pytest.mark.parametrize("corpo", [
    {"ok": False, "erro": "assinatura_invalida", "mensagem": "x"},
    ok("sistema"),                       # papel de rotina nunca vale para um telefone
    ok("admin"),                         # papel fora do combinado
    {"ok": True},                        # sem dados
    {"ok": "true", "dados": {"papel": "dono"}},
    "lixo",
])
def test_resposta_fora_do_combinado_nao_vale(corpo):
    with pytest.raises(ValueError):
        core.papel_do_sistema(corpo)


# -- precedência ------------------------------------------------------------------

LOCAL_DONO = {"nome": "Simone", "papel": "dono"}


def test_sistema_com_papel_de_equipe_vale():
    assert core.combinar_papel({"papel": "patio", "nome": "Novo"}, None) == {"nome": "Novo", "papel": "patio", "fonte": "sistema"}
    # quem está nos dois: vale o cadastro do sistema
    assert core.combinar_papel({"papel": "gestao", "nome": ""}, LOCAL_DONO)["papel"] == "gestao"
    assert core.combinar_papel({"papel": "gestao", "nome": ""}, LOCAL_DONO)["nome"] == "Simone"


def test_sistema_cliente_ou_falha_cai_no_equipe_json():
    assert core.combinar_papel({"papel": "cliente", "nome": ""}, LOCAL_DONO) is LOCAL_DONO
    assert core.combinar_papel(None, LOCAL_DONO) is LOCAL_DONO
    assert core.combinar_papel(None, None) is None
    assert core.combinar_papel({"papel": "cliente", "nome": ""}, None) is None


def test_indice_com_sistema():
    indice = core.equipe_index([{"nome": "Simone", "telefone": SIMONE, "papel": "dono"}])
    assert core.papel_de(NOVO, core.indice_com_sistema(NOVO, indice, {"papel": "patio", "nome": "Novo"})) == core.PATIO
    assert core.papel_de(NOVO, core.indice_com_sistema(NOVO, indice, None)) == core.CLIENTE
    assert core.papel_de(SIMONE, core.indice_com_sistema(SIMONE, indice, {"papel": "cliente", "nome": ""})) == core.DONO
    assert core.indice_com_sistema(core.SYSTEM, indice, {"papel": "patio"}) is indice
    assert NOVO not in indice  # não mexe no índice do equipe.json


# -- HTTP assinado ----------------------------------------------------------------

class _Resp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def test_consulta_assinada_igual_ao_mcp():
    pedidos = []

    def abrir(req, timeout):
        pedidos.append((req, timeout))
        return _Resp(json.dumps(ok("patio", "Novo")).encode())

    r = cadastro.consultar_quem_sou(NOVO, url="https://x.supabase.co/functions/v1/arnaldo-api/", token="tok",
                                    segredo="s3gr3d0", anon="anon-jwt", abrir=abrir, agora_ms=1_000_000)
    assert r == {"papel": "patio", "nome": "Novo"}
    req, timeout = pedidos[0]
    assert req.full_url == "https://x.supabase.co/functions/v1/arnaldo-api"
    assert req.get_method() == "POST"
    assert req.get_header("X-arnaldo-token") == "tok"
    assert req.get_header("Authorization") == "Bearer anon-jwt"
    assert timeout == cadastro.TIMEOUT_S
    corpo = json.loads(req.data)
    assert corpo["acao"] == "quem_sou"
    assert corpo["caller"] == core.caller_envelope(NOVO, cadastro.SESSAO, "s3gr3d0", now_ms=1_000_000)


def test_consulta_sem_configuracao_falha():
    with pytest.raises(RuntimeError):
        cadastro.consultar_quem_sou(NOVO, url="", token="tok", segredo="s")


# -- cache ------------------------------------------------------------------------

class Relogio:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t


def _cad(consultar, relogio=None, **kw):
    return cadastro.Cadastro(consultar, LOG, relogio=relogio or Relogio(), **kw)


def test_cache_vale_10_min_e_depois_consulta_de_novo():
    chamadas = []
    relogio = Relogio()
    c = _cad(lambda p: chamadas.append(p) or {"papel": "patio", "nome": "Novo"}, relogio)
    assert c.ler(NOVO) is None                     # frio: só memória, dispara em segundo plano
    assert c.garantir_bloqueando(NOVO) == {"papel": "patio", "nome": "Novo"}
    relogio.t += cadastro.TTL_S - 1
    assert c.fresco(NOVO) and c.ler(NOVO)["papel"] == "patio"
    assert c.garantir_bloqueando(NOVO)["papel"] == "patio"
    assert len(chamadas) == 1
    relogio.t += 2                                  # venceu
    assert not c.fresco(NOVO)
    assert c.garantir_bloqueando(NOVO)["papel"] == "patio"
    assert len(chamadas) == 2


def test_falha_vale_equipe_json_e_nao_martela_a_api():
    chamadas = []
    relogio = Relogio()

    def quebra(p):
        chamadas.append(p)
        raise OSError("rede fora")

    c = _cad(quebra, relogio)
    assert c.garantir_bloqueando(NOVO) is None
    assert c.fresco(NOVO) and c.ler(NOVO) is None   # falha guardada: não consulta de novo já
    assert c.garantir_bloqueando(NOVO) is None
    assert len(chamadas) == 1
    relogio.t += cadastro.FALHA_TTL_S + 1
    assert c.garantir_bloqueando(NOVO) is None
    assert len(chamadas) == 2


def test_falha_depois_de_acerto_derruba_o_papel_do_sistema():
    respostas = [{"papel": "patio", "nome": "Novo"}, OSError("fora")]
    relogio = Relogio()

    def consultar(p):
        r = respostas.pop(0)
        if isinstance(r, Exception):
            raise r
        return r

    c = _cad(consultar, relogio)
    assert c.garantir_bloqueando(NOVO)["papel"] == "patio"
    relogio.t += cadastro.TTL_S + 1
    assert c.garantir_bloqueando(NOVO) is None      # não segue promovido com dado vencido


def test_so_consulta_telefone_canonico_e_quando_ligado():
    chamadas = []
    c = _cad(lambda p: chamadas.append(p) or {"papel": "patio", "nome": ""})
    for ident in (None, "", core.SYSTEM, "111122223333444@lid", "554791112222"):
        assert c.garantir_bloqueando(ident) is None
    desligado = _cad(lambda p: chamadas.append(p) or {"papel": "patio", "nome": ""}, ativo=lambda: False)
    assert desligado.fresco(NOVO) and desligado.garantir_bloqueando(NOVO) is None
    assert chamadas == []


def test_consultas_simultaneas_viram_uma_so():
    chamadas = []
    libera = threading.Event()

    def lenta(p):
        chamadas.append(p)
        libera.wait(2)
        return {"papel": "patio", "nome": ""}

    c = _cad(lenta)
    f1, f2 = c._disparar(NOVO), c._disparar(NOVO)
    assert f1 is f2
    libera.set()
    assert f1.result(2)["papel"] == "patio"
    assert chamadas == [NOVO]


def test_api_lenta_nao_trava_o_loop_e_cai_no_equipe_json():
    libera = threading.Event()

    def lenta(p):
        libera.wait(3)
        return {"papel": "patio", "nome": ""}

    c = _cad(lenta, timeout=0.2)

    async def cenario():
        batidas = []

        async def outra_conversa():
            for _ in range(5):
                batidas.append(time.monotonic())
                await asyncio.sleep(0.02)

        t0 = time.monotonic()
        r, _ = await asyncio.gather(c.garantir(NOVO), outra_conversa())
        return r, time.monotonic() - t0, batidas

    r, gasto, batidas = asyncio.run(cenario())
    libera.set()
    assert r is None                     # passou do tempo: vale o equipe.json
    assert gasto < 1.5                   # timeout curto, não o da rede
    assert len(batidas) == 5             # a outra conversa andou enquanto esta esperava


# -- no plugin ----------------------------------------------------------------------

@pytest.fixture
def casa(tmp_path, monkeypatch):
    monkeypatch.setattr(plugin, "_home", lambda: str(tmp_path))
    (tmp_path / "equipe.json").write_text(json.dumps({"equipe": [
        {"nome": "Jose", "telefone": JOSE, "papel": "patio"},
        {"nome": "Simone", "telefone": SIMONE, "papel": "dono"},
    ]}), encoding="utf-8")
    plugin._equipe_cache.update({"mtime": 0.0, "indice": {}, "grupos": {}})
    monkeypatch.setattr(plugin, "_aliases", lambda ident: set())
    plugin._turnos.clear()
    monkeypatch.setenv("ARNALDO_CALLER_SECRET", "s3gr3d0")
    yield tmp_path
    plugin._vivo.update({"loop": None, "adapter": None})


def sistema(monkeypatch, respostas: dict):
    """Troca a API por um dicionário {telefone: resposta | Exception}. Desconhecido = cliente."""
    chamadas = []

    def consultar(phone):
        chamadas.append(phone)
        r = respostas.get(phone, {"papel": "cliente", "nome": ""})
        if isinstance(r, Exception):
            raise r
        return r

    monkeypatch.setattr(plugin, "_cadastro", cadastro.Cadastro(consultar, LOG, ativo=lambda: True))
    return chamadas


def evento(chat, texto="bom dia"):
    source = types.SimpleNamespace(chat_id=chat, user_id=chat, chat_type="dm", platform="whatsapp")
    return types.SimpleNamespace(source=source, text=texto, metadata={}, raw_message={}, message_type="text")


def despachar_no_loop(ev):
    async def _rodar():
        r = plugin.on_pre_gateway_dispatch(event=ev)
        return await r if inspect.isawaitable(r) else r
    return asyncio.run(_rodar())


def test_mecanico_cadastrado_so_no_sistema_vira_patio(casa, monkeypatch):
    sistema(monkeypatch, {NOVO: {"papel": "patio", "nome": "Novo Mecânico"}})
    (casa / "PAUSA").write_text("em configuracao", encoding="utf-8")
    # no gateway o despacho espera a consulta (corrotina aguardada pelo Hermes) e o pátio passa da pausa
    assert despachar_no_loop(evento(NOVO_JID)) is None
    assert core.debounce_seconds(core.papel_de(NOVO, plugin._indice(NOVO))) == 0.0
    # no turno: contexto de pátio (sem valores) e ferramenta de equipe liberada e assinada
    monkeypatch.setattr(plugin, "_quem_e_onde", lambda sid: (NOVO, None))
    ctx = plugin.on_pre_llm_call(session_id="s1")["context"]
    assert "PATIO/MECANICO — Novo Mecânico" in ctx and "SIGILO FINANCEIRO ATIVO" in ctx
    d = plugin.on_pre_tool_call(tool_name="mcp__oficina__agenda_do_dia", args={}, session_id="s1")
    assert d["action"] == "modify" and d["args"]["caller"]["phone"] == NOVO
    # e a muralha vale para ele
    monkeypatch.setattr(plugin, "_model_texts", {"s1": [(time.time(), "Fica R$ 450,00")]})
    assert plugin.on_transform_llm_output("Fica R$ 450,00", "s1", "whatsapp") == core.RECUSA_SIGILO


def test_cliente_continua_cliente(casa, monkeypatch):
    sistema(monkeypatch, {})
    (casa / "PAUSA").write_text("em configuracao", encoding="utf-8")
    assert despachar_no_loop(evento(CLIENTE + "@s.whatsapp.net"))["action"] == "skip"
    monkeypatch.setattr(plugin, "_quem_e_onde", lambda sid: (CLIENTE, None))
    d = plugin.on_pre_tool_call(tool_name="mcp__oficina__agenda_do_dia", args={}, session_id="s1")
    assert d["action"] == "block"


def test_api_fora_nunca_promove_e_mantem_o_equipe_json(casa, monkeypatch):
    chamadas = sistema(monkeypatch, {NOVO: OSError("rede fora"), JOSE: OSError("rede fora")})
    (casa / "PAUSA").write_text("em configuracao", encoding="utf-8")
    assert despachar_no_loop(evento(NOVO_JID))["action"] == "skip"           # não cadastrado no json: cliente
    assert despachar_no_loop(evento("554796432811@s.whatsapp.net")) is None  # José segue pátio pelo json
    monkeypatch.setattr(plugin, "_quem_e_onde", lambda sid: (NOVO, None))
    assert plugin.on_pre_tool_call(tool_name="mcp__oficina__agenda_do_dia", args={}, session_id="s1")["action"] == "block"
    assert "Quem fala: CLIENTE" in plugin.on_pre_llm_call(session_id="s1")["context"]
    assert chamadas.count(NOVO) == 1  # a falha fica guardada: não consulta a cada gancho


def test_equipe_json_reforca_quem_o_sistema_chama_de_cliente(casa, monkeypatch):
    sistema(monkeypatch, {SIMONE: {"papel": "cliente", "nome": ""}})
    monkeypatch.setattr(plugin, "_quem_e_onde", lambda sid: (SIMONE, None))
    assert "DONO — Simone" in plugin.on_pre_llm_call(session_id="s1")["context"]


def test_sistema_vence_o_equipe_json_entre_papeis_de_equipe(casa, monkeypatch):
    sistema(monkeypatch, {JOSE: {"papel": "gestao", "nome": "José"}})
    monkeypatch.setattr(plugin, "_quem_e_onde", lambda sid: (JOSE, None))
    ctx = plugin.on_pre_llm_call(session_id="s1")["context"]
    assert "GESTAO/FINANCEIRO — José" in ctx and "SIGILO" not in ctx


def test_despacho_fora_do_loop_nao_espera(casa, monkeypatch):
    libera = threading.Event()

    def lenta(phone):
        libera.wait(3)
        return {"papel": "patio", "nome": ""}

    monkeypatch.setattr(plugin, "_cadastro", cadastro.Cadastro(lenta, LOG, ativo=lambda: True))
    (casa / "PAUSA").write_text("em configuracao", encoding="utf-8")
    t0 = time.monotonic()
    r = plugin.on_pre_gateway_dispatch(event=evento(NOVO_JID))  # sem loop: decide já com o equipe.json
    assert time.monotonic() - t0 < 0.5
    assert r["action"] == "skip"
    libera.set()


def test_cache_quente_despacha_sem_corrotina(casa, monkeypatch):
    sistema(monkeypatch, {NOVO: {"papel": "patio", "nome": ""}})
    plugin._cadastro.garantir_bloqueando(NOVO)

    async def _rodar():
        return plugin.on_pre_gateway_dispatch(event=evento(NOVO_JID))

    assert not inspect.isawaitable(asyncio.run(_rodar()))


def test_sem_configuracao_fica_como_antes(casa, monkeypatch):
    for k in ("ARNALDO_API_URL", "ARNALDO_API_TOKEN"):
        monkeypatch.delenv(k, raising=False)
    assert plugin._api_configurada() is False

    async def _rodar():
        return plugin.on_pre_gateway_dispatch(event=evento(NOVO_JID))

    monkeypatch.setattr(plugin, "_cadastro", cadastro.Cadastro(plugin._consultar_api, LOG, ativo=plugin._api_configurada))
    assert not inspect.isawaitable(asyncio.run(_rodar()))
