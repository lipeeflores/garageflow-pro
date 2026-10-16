// Catálogo de ferramentas do Arnaldo. O nome de cada uma é o nome da `acao` da edge function
// arnaldo-api (garageflow); o Hermes expõe como mcp__oficina__<nome>.
// O argumento `caller` NÃO aparece nos schemas: o plugin md_arnaldo injeta um assinado a cada chamada.
// O papel (cliente/pátio/gestão/dono) é decidido pela API, pelo telefone assinado; as descrições
// abaixo só orientam o modelo.

const str = (description, extra = {}) => ({ type: 'string', description, ...extra });
const num = description => ({ type: 'number', description });
const int = description => ({ type: 'integer', description });
const bool = description => ({ type: 'boolean', description });
const date = description => str(`${description} (formato AAAA-MM-DD)`, { pattern: '^\\d{4}-\\d{2}-\\d{2}$' });
const iso = description => str(`${description} (ISO-8601 com fuso, ex.: 2026-10-20T09:00:00-03:00)`);

// O modelo às vezes inventa um `reason` (motivo da chamada) que nenhuma ferramenta pede. Em vez de
// brigar com o prompt, toda ferramenta aceita o campo: é opcional, ignorado e só serve de auditoria.
const obj = (properties, required = []) => ({
  type: 'object',
  properties: { ...properties, reason: str('Motivo da chamada (opcional, só para auditoria; ignorado no comportamento).') },
  required,
  additionalProperties: false,
});

const PLACA = str('Placa do veículo (com ou sem hífen, maiúscula ou minúscula).');
const OS_ID = str('A OS: o número que aparece nos documentos (ex.: 42, "OS 42" ou "0042") ou o id (UUID) devolvido por outra ferramenta. Nunca invente.');
const AGENDAMENTO_ID = str('id do agendamento (UUID) devolvido por meus_agendamentos, horarios ou agenda_do_dia. Nunca invente.');
const ETAPAS = ['AGUARDANDO_CHECKIN', 'CHECKIN_CONCLUIDO', 'EM_DIAGNOSTICO', 'AGUARDANDO_ORCAMENTO', 'AGUARDANDO_APROVACAO', 'APROVADO', 'EM_EXECUCAO', 'EM_QUALIDADE', 'AJUSTES', 'PRONTO_PARA_RETIRADA', 'FINALIZADO', 'CANCELADO'];

// ── P0: precisa estar pronto na segunda ────────────────────────────────────
export const TOOLS_P0 = [
  {
    name: 'quem_sou',
    description: 'Diz quem está falando para o sistema da oficina (cliente, pátio, gestão ou dono) e se esse papel pode ver valores. Use na dúvida sobre o que a pessoa pode pedir. Não use para decidir sigilo por conta própria: a regra de valor já é aplicada pelo sistema.',
    inputSchema: obj({}),
  },
  {
    name: 'meus_dados',
    description: 'Cliente: busca o cadastro e os veículos do número que está falando. Use no início da conversa com cliente para saber se já é cadastrado. Se vier cliente nulo, é cliente novo: peça nome, placa, marca e modelo e use cadastrar_cliente_veiculo. Não invente dados que não vieram aqui.',
    inputSchema: obj({}),
  },
  {
    name: 'cadastrar_cliente_veiculo',
    description: 'Cadastra (ou atualiza) cliente e veículo. Para cliente, o telefone é SEMPRE o do WhatsApp da conversa: não pergunte e não passe telefone. Equipe pode informar o telefone do cliente. Se a placa já for de outro cliente, o sistema devolve conflito e não altera nada: não insista nem diga que cadastrou. Use antes de agendar cliente novo.',
    inputSchema: obj({
      nome: str('Nome do cliente'),
      placa: PLACA,
      marca: str('Marca do veículo (ex.: Fiat)'),
      modelo: str('Modelo do veículo (ex.: Uno Mille)'),
      ano: int('Ano do veículo (opcional)'),
      cor: str('Cor (opcional)'),
      telefone: str('Só para a equipe: WhatsApp do cliente que está sendo cadastrado. Cliente nunca passa.'),
    }, ['nome', 'placa', 'marca', 'modelo']),
  },
  {
    name: 'status_do_carro',
    description: 'Use quando alguém perguntar como está o carro. Para cliente, só funciona com carro do próprio número. Se o orçamento estiver aguardando aprovação, devolve o link_orcamento: mande esse link ao cliente. Nunca invente etapa, prazo ou valor; diga só o que a ferramenta devolveu.',
    inputSchema: obj({ placa: PLACA }, ['placa']),
  },
  {
    name: 'horarios_livres',
    description: 'Horários livres para agendar entre duas datas (máximo 14 dias). Obrigatório antes de oferecer qualquer horário ao cliente. Ofereça no máximo 3 opções. Nunca ofereça horário que não veio daqui.',
    inputSchema: obj({ de: date('Primeiro dia a consultar'), ate: date('Último dia (opcional; padrão: o mesmo dia)') }, ['de']),
  },
  {
    name: 'agendar',
    description: 'Grava o agendamento. SÓ chame depois de o cliente confirmar dia e hora, e depois de o veículo estar cadastrado. Só diga "agendei" se vier ok: true. Se vier conflito_agenda, ofereça os horários que a própria resposta listar.',
    inputSchema: obj({ placa: PLACA, inicio: iso('Início do horário escolhido, exatamente como veio de horarios_livres'), motivo: str('O que o cliente quer resolver (ex.: revisão, barulho na suspensão)') }, ['placa', 'inicio', 'motivo']),
  },
  {
    name: 'meus_agendamentos',
    description: 'Cliente: agendamentos futuros dos veículos do próprio número. Use quando perguntarem "tenho horário marcado?" ou antes de remarcar/cancelar para achar o id.',
    inputSchema: obj({}),
  },
  {
    name: 'remarcar',
    description: 'Troca o horário de um agendamento (o antigo fica no histórico). Consulte horarios_livres antes e confirme com o cliente o novo horário. Cliente só mexe no próprio agendamento. Só diga que remarcou se vier ok: true.',
    inputSchema: obj({ agendamento_id: AGENDAMENTO_ID, novo_inicio: iso('Novo início, exatamente como veio de horarios_livres') }, ['agendamento_id', 'novo_inicio']),
  },
  {
    name: 'cancelar_agendamento',
    description: 'Cancela um agendamento. Confirme com o cliente antes. Cliente só cancela o próprio. Só diga que cancelou se vier ok: true.',
    inputSchema: obj({ agendamento_id: AGENDAMENTO_ID, motivo: str('Motivo informado (opcional)') }, ['agendamento_id']),
  },
  {
    name: 'agenda_do_dia',
    description: 'Equipe: agendamentos do dia com cliente e veículo, mais quem não compareceu nos 3 dias anteriores. Use quando perguntarem "o que tem hoje?" ou "quem vem amanhã?". Não use para cliente.',
    inputSchema: obj({ data: date('Dia a consultar (padrão: hoje)') }),
  },
  {
    name: 'buscar',
    description: 'Equipe: procura cliente, veículo e OS por placa, nome ou telefone (até 10 resultados). Use quando a equipe citar um carro ou cliente sem dar o id. Não use para cliente.',
    inputSchema: obj({ termo: str('Placa (inteira ou começo), nome ou telefone') }, ['termo']),
  },
  {
    name: 'ver_os',
    description: 'Equipe: mostra a OS com check-in, diagnósticos, itens e últimos eventos. Informe o id da OS ou a placa (pega a OS aberta mais recente). Valores só aparecem para gestão e dono; para o pátio o sistema já vem sem dinheiro. Nunca complete valor que não veio.',
    inputSchema: obj({ os_id: OS_ID, placa: PLACA }),
  },
  {
    name: 'abrir_os',
    description: 'Equipe: abre uma OS (começa em aguardando check-in) para um veículo cadastrado. Se a pessoa chegou com agendamento, passe agendamento_id para marcá-lo como "chegou". Só diga que abriu se vier ok: true e o os_id. Não abra OS duplicada: use buscar/ver_os antes.',
    inputSchema: obj({
      placa: PLACA,
      queixa: str('Queixa inicial do cliente, nas palavras dele'),
      agendamento_id: AGENDAMENTO_ID,
      prioridade: str('Prioridade', { enum: ['BAIXA', 'MEDIA', 'ALTA'] }),
      previsao_entrega: iso('Previsão de entrega (opcional)'),
    }, ['placa', 'queixa']),
  },
  {
    name: 'registrar_checkin',
    description: 'Equipe: registra a entrada do carro (km, combustível, pertences) e passa a OS para check-in concluído. Cada OS tem um único check-in; se já existir, o sistema recusa. Pergunte km e nível de combustível antes; não invente.',
    inputSchema: obj({
      os_id: OS_ID,
      km: int('Quilometragem do painel'),
      combustivel: str('Nível de combustível', { enum: ['RESERVA', 'QUARTO', 'METADE', 'TRES_QUARTOS', 'COMPLETO'] }),
      pertences: str('Pertences deixados no carro (opcional)'),
      observacoes: str('Observações da entrada (opcional)'),
      tem_estepe: bool('O carro tem estepe? (pergunte; não presuma)'),
      estado_estepe: str('Estado do estepe, ex.: bom, careca, murcho (opcional)'),
      tem_macaco: bool('O carro tem macaco?'),
      tem_chave_roda: bool('O carro tem chave de roda?'),
      avarias: str('Avarias que o carro já tinha na entrada: risco, amassado, farol trincado… (opcional)'),
    }, ['os_id', 'km', 'combustivel']),
  },
  {
    name: 'anexar_foto',
    description: 'Equipe: anexa à OS uma foto que acabou de chegar no WhatsApp. Passe o caminho do arquivo que o Hermes mostrou para a imagem recebida (caminho_imagem); não envie o conteúdo da imagem. Foto do check-in usa tipo CHECKIN_PHOTO. Só diga que anexou se vier ok: true.',
    inputSchema: obj({
      os_id: OS_ID,
      tipo: str('Tipo da foto', { enum: ['CHECKIN_PHOTO', 'DIAGNOSIS_PHOTO', 'EXECUTION_PHOTO', 'OTHER'] }),
      caminho_imagem: str('Caminho local da imagem recebida (…/cache/images/img_xxx.jpg), exatamente como o Hermes mostrou.'),
      legenda: str('Legenda curta (opcional)'),
    }, ['os_id', 'tipo', 'caminho_imagem']),
  },
  {
    name: 'registrar_diagnostico',
    description: 'Equipe do pátio, gestão ou dono: grava o laudo do diagnóstico e passa a OS para aguardando orçamento. Use as palavras do mecânico, sem inventar. Não grava valor.',
    inputSchema: obj({ os_id: OS_ID, laudo: str('Laudo do diagnóstico') }, ['os_id', 'laudo']),
  },
  {
    name: 'adicionar_itens',
    description: 'Equipe: lista serviços e peças da OS (SERVICE ou PART). Preço NÃO é dado aqui: é com a gestão. Antes de adicionar peças de um combo (kit), confira a lista completa com quem pediu.',
    inputSchema: obj({
      os_id: OS_ID,
      itens: {
        type: 'array',
        description: 'Serviços e peças a adicionar',
        minItems: 1,
        items: {
          type: 'object',
          properties: {
            tipo: str('SERVICE ou PART', { enum: ['SERVICE', 'PART'] }),
            descricao: str('Descrição do item'),
            quantidade: int('Quantidade (padrão 1)'),
            codigo: str('Código da peça (opcional)'),
          },
          required: ['tipo', 'descricao'],
          additionalProperties: false,
        },
      },
    }, ['os_id', 'itens']),
  },
  {
    name: 'mover_etapa',
    description: `Equipe: muda a etapa da OS (${ETAPAS.join(', ')}). O sistema valida o que cada papel pode fazer; se recusar (etapa_invalida), explique e não tente de outro jeito. Pátio só anda nas etapas do pátio; aprovar, finalizar e cancelar são da gestão/dono. Só diga que mudou se vier ok: true.`,
    inputSchema: obj({ os_id: OS_ID, etapa: str('Nova etapa', { enum: ETAPAS }), observacao: str('Nota que fica no histórico da OS (opcional)') }, ['os_id', 'etapa']),
  },
  {
    name: 'atribuir',
    description: 'Equipe: define o mecânico responsável e/ou o box da OS. Passe o nome do mecânico como a pessoa falou; se houver mais de um com esse nome, o sistema lista os candidatos: pergunte qual.',
    inputSchema: obj({ os_id: OS_ID, mecanico: str('Nome do mecânico (opcional)'), box: str('Local do carro (opcional)', { enum: ['BOX_1', 'BOX_2', 'BOX_3', 'BOX_4', 'PATIO'] }) }, ['os_id']),
  },
  {
    name: 'registrar_entrega',
    description: 'Gestão e dono: registra a entrega do carro ao cliente (km de saída, garantia e próxima revisão) e finaliza a OS se ela estava pronta para retirada. Pergunte o km de saída; garantia e revisão são opcionais (a garantia padrão vem da configuração da oficina). A entrega só pode ser registrada uma vez. Depois dela o recibo pode ser gerado com gerar_documento. Só diga que registrou se vier ok: true.',
    inputSchema: obj({
      os_id: OS_ID,
      km_saida: int('Quilometragem do painel na saída'),
      garantia_dias: int('Dias de garantia (opcional; padrão da oficina)'),
      proxima_revisao_km: int('Km da próxima revisão sugerida (opcional)'),
      proxima_revisao_data: date('Data da próxima revisão sugerida (opcional)'),
    }, ['os_id', 'km_saida']),
  },
  {
    name: 'consultar_placa',
    description: 'Consulta dados públicos de uma placa (marca, modelo, ano, cor, combustível, motor, município). Use ANTES de perguntar marca e modelo: se achar, confirme com o cliente ("é um Gol 2015 prata?") antes de cadastrar. Se vier placa_indisponivel, pergunte ao cliente normalmente. Nunca invente dado de placa nem cadastre sem a confirmação dele.',
    inputSchema: obj({ placa: PLACA }, ['placa']),
  },
  {
    name: 'gerar_documento',
    description: 'Gera um documento da oficina como arquivo para mandar no WhatsApp: orcamento (PDF com valores), ficha_entrada (PDF, estado do carro na chegada, sem valores), os_patio (imagem para o mecânico, NUNCA tem valor) ou recibo (PDF com valores e garantia). Informe a OS por os_id, placa ou numero da OS. O sistema recusa o que o papel de quem pediu não pode receber: não tente contornar. Quando vier ok: true, escreva a mensagem e, numa linha própria no fim da resposta, MEDIA:<caminho> com o caminho EXATO devolvido. Orçamento e recibo nunca vão para grupo que não seja o canal financeiro, nem para o pátio. Só diga que mandou depois do ok: true.',
    inputSchema: obj({
      tipo: str('Documento a gerar', { enum: ['orcamento', 'ficha_entrada', 'os_patio', 'recibo'] }),
      os_id: OS_ID,
      placa: PLACA,
      numero: int('Número da OS (ex.: 42 para a OS 0042)'),
    }, ['tipo']),
  },
];

// ── P1: gestão e financeiro (só entram com ARNALDO_ENABLE_P1=1, depois de a API ter essas ações) ──
export const TOOLS_P1 = [
  {
    name: 'precificar_itens',
    description: 'Gestão e dono: define preço (e custo, opcional) dos itens da OS. Só para quem vê dinheiro. Nunca repita valor para cliente ou pátio.',
    inputSchema: obj({
      os_id: OS_ID,
      precos: {
        type: 'array',
        description: 'Preço de cada item',
        minItems: 1,
        items: {
          type: 'object',
          properties: { item_id: str('id do item (de ver_os)'), preco_unitario: num('Preço unitário'), custo_unitario: num('Custo unitário (opcional)') },
          required: ['item_id', 'preco_unitario'],
          additionalProperties: false,
        },
      },
    }, ['os_id', 'precos']),
  },
  {
    name: 'enviar_orcamento',
    description: 'Gestão e dono: fecha o orçamento da OS (todos os itens precisam ter preço) e a coloca em aguardando aprovação. Devolve o link do orçamento. Você nunca diz valor ao cliente: só entrega o link.',
    inputSchema: obj({ os_id: OS_ID }, ['os_id']),
  },
  {
    name: 'controle_qualidade',
    description: 'Gestão e dono: registra o controle de qualidade. Aprovado leva a pronto para retirada; reprovado volta para ajustes.',
    inputSchema: obj({ os_id: OS_ID, aprovado: bool('true se passou no teste final'), notas: str('Notas do controle (opcional)') }, ['os_id', 'aprovado']),
  },
  {
    name: 'registrar_pagamento',
    description: 'Gestão e dono: registra pagamento recebido da OS. Confirme valor e forma com a pessoa antes. Só diga que registrou se vier ok: true.',
    inputSchema: obj({ os_id: OS_ID, valor: num('Valor recebido'), forma: str('Forma de pagamento', { enum: ['PIX', 'CARTAO', 'DINHEIRO', 'MARCAR'] }) }, ['os_id', 'valor', 'forma']),
  },
  {
    name: 'resumo_financeiro',
    description: 'Gestão e dono: resumo financeiro de um período. Nunca em grupo nem para pátio ou cliente.',
    inputSchema: obj({ de: date('Início do período'), ate: date('Fim do período') }, ['de', 'ate']),
  },
  {
    name: 'contas_a_pagar',
    description: 'Gestão e dono: lista, cria ou paga contas a pagar.',
    inputSchema: obj({
      acao: str('O que fazer', { enum: ['listar', 'criar', 'pagar'] }),
      conta_id: str('id da conta (para pagar)'),
      descricao: str('Descrição (para criar)'),
      valor: num('Valor (para criar)'),
      vencimento: date('Vencimento (para criar)'),
    }, ['acao']),
  },
];

export const P1_ATIVO = process.env.ARNALDO_ENABLE_P1 === '1';
export const TOOLS = P1_ATIVO ? [...TOOLS_P0, ...TOOLS_P1] : TOOLS_P0;
