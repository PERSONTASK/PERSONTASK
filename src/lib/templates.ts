import type { FieldType } from '@/types';

/**
 * Templates de Painel do PERSONTASK.
 *
 * A ESTRUTURA (cores, tipos de campo, em que coluna cada card entra) fica em
 * `SHAPE` — igual para todos os idiomas. Só os TEXTOS ficam em `TEXT`, por
 * idioma. `getTemplates(lang)` junta os dois e devolve os templates prontos.
 */

export type TemplateId = 'crm' | 'projects' | 'tasks';

/** Cadastro de exemplo criado junto com o Painel (CRM). */
export interface TemplateOrganization {
  name: string;
  fantasy_name?: string;
  cnpj?: string;
  status?: string;
  system?: string;
  segment?: string;
}

export interface TemplateContact {
  name: string;
  phone?: string;
  phone_type?: string;
  email?: string;
  email_type?: string;
  organizationIndex?: number;
}

export interface TemplateDef {
  id: TemplateId;
  name: string;
  description: string;
  boardName: string;
  columns: { title: string; color: string }[];
  labels: { name: string; color: string }[];
  fields: { name: string; type: FieldType; options?: string[]; showOnFace: boolean; money?: boolean }[];
  organizations?: TemplateOrganization[];
  contacts?: TemplateContact[];
  cards: {
    columnIndex: number;
    title: string;
    description?: string;
    labelIndexes?: number[];
    checklist?: { title: string; items: string[] };
    /** Índice em `organizations` / `contacts` (CRM) a vincular ao card. */
    organizationIndex?: number;
    contactIndex?: number;
    /** Valores de exemplo dos campos personalizados, por índice de `fields`. */
    fieldValues?: Record<number, string | number | boolean>;
    /**
     * Cronograma modelo do card (fases e tarefas, na ordem). Entra em
     * `items.schedule_tasks` com datas e durações EM BRANCO, em modo
     * automático e com as predecessoras encadeadas — basta digitar as
     * durações para o cronograma se montar.
     */
    schedule?: { name: string; indent: number; duration: number | null }[];
  }[];
}

interface TemplateText {
  name: string;
  description: string;
  board: string;
  columns: string[];
  labels: string[];
  fields: string[];
  /** Opções das listas suspensas, por índice do campo. */
  options?: Record<number, string[]>;
  organizations?: TemplateOrganization[];
  contacts?: TemplateContact[];
  cards: {
    title: string;
    description?: string;
    checklist?: { title: string; items: string[] };
    /** Nomes das fases/tarefas do cronograma modelo (os níveis ficam em SHAPE). */
    schedule?: string[];
  }[];
}

/**
 * Valor de exemplo de um campo personalizado. Listas suspensas apontam a
 * OPÇÃO por índice (as opções são traduzidas); datas são relativas a hoje,
 * para o exemplo nunca nascer vencido.
 */
type TemplateFieldValue = { option: number } | { value: string | number } | { inDays: number };

/** Data relativa a hoje no formato do campo datetime (YYYY-MM-DD). */
function dateIn(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const SHAPE: Record<
  TemplateId,
  {
    columnColors: string[];
    labelColors: string[];
    fieldTypes: FieldType[];
    fieldShowOnFace: boolean[];
    /** Campos numéricos exibidos como dinheiro (moeda do Espaço). */
    fieldMoney?: Record<number, boolean>;
    cardColumns: number[];
    cardLabels: number[][];
    /** Níveis do cronograma modelo (0 = fase, 1 = tarefa), por índice do card. */
    cardScheduleIndents?: Record<number, number[]>;
    /** Durações de exemplo em dias úteis (null = fase, que é consolidada). */
    cardScheduleDurations?: Record<number, (number | null)[]>;
    /** Cadastro de CRM vinculado a cada card (índice em organizations/contacts). */
    cardClients?: Record<number, { organization: number; contact: number }>;
    /** Valores de exemplo dos campos, por índice do card e do campo. */
    cardFieldValues?: Record<number, Record<number, TemplateFieldValue>>;
  }
> = {
  crm: {
    columnColors: ['#64748B', '#3B82F6', '#6366F1', '#8B5CF6', '#10B981', '#EF4444'],
    labelColors: ['#EF4444', '#F59E0B', '#0EA5E9'],
    fieldTypes: ['number', 'datetime', 'select', 'select', 'select', 'select'],
    fieldShowOnFace: [true, true, false, false, false, false],
    fieldMoney: { 0: true },
    cardColumns: [0, 2],
    cardLabels: [[2], [0]],
    cardClients: {
      0: { organization: 0, contact: 0 },
      1: { organization: 1, contact: 1 },
    },
    cardFieldValues: {
      // Lead frio recém-captado: valor estimado e fechamento mais longe.
      0: {
        0: { value: 18500 },
        1: { inDays: 45 },
        2: { option: 2 },
        3: { option: 0 },
        4: { option: 0 },
      },
      // Proposta já enviada: valor fechado, data próxima e feeling bom.
      1: {
        0: { value: 42000 },
        1: { inDays: 12 },
        2: { option: 0 },
        3: { option: 1 },
        4: { option: 0 },
      },
    },
  },
  projects: {
    columnColors: ['#64748B', '#3B82F6', '#6366F1', '#F59E0B', '#10B981'],
    labelColors: ['#EF4444', '#F59E0B', '#10B981'],
    // Prioridade · Tipo de Projeto · Número da Proposta
    fieldTypes: ['select', 'select', 'text'],
    fieldShowOnFace: [true, true, false],
    cardColumns: [1, 0],
    cardLabels: [[1], []],
    cardScheduleIndents: {
      0: [
        0, 1, 1, 1, 1, 1, // Iniciação
        0, 1, 1, 1, 1, 1, // Execução
        0, 1, 1, 1, 1, // Homologação (termina no GO? NO GO?)
        0, 1, 1, // Produção
        0, 1, 1, // Finalização
      ],
    },
    // Durações de exemplo, em dias úteis (fases ficam em branco: elas
    // consolidam as filhas). ~74 dias úteis no total.
    cardScheduleDurations: {
      0: [
        null, 1, 1, 5, 3, 2, // Iniciação
        null, 15, 5, 3, 5, 4, // Execução
        null, 3, 5, 4, 1, // Homologação
        null, 10, 5, // Produção
        null, 1, 1, // Finalização
      ],
    },
  },
  tasks: {
    columnColors: ['#64748B', '#3B82F6', '#10B981'],
    labelColors: ['#EF4444', '#F59E0B', '#0EA5E9'],
    fieldTypes: ['select'],
    fieldShowOnFace: [true],
    cardColumns: [0, 1],
    cardLabels: [[1], [0]],
  },
};

type Lang = 'pt' | 'en' | 'es';

const TEXT: Record<Lang, Record<TemplateId, TemplateText>> = {
  pt: {
    crm: {
      name: 'CRM / Funil de Vendas',
      description: 'Leads, propostas e fechamento',
      board: 'Funil de Vendas',
      columns: ['Leads', 'Contato feito', 'Proposta enviada', 'Negociação', 'Ganho', 'Perdido'],
      labels: ['Quente', 'Morno', 'Frio'],
      fields: [
        'Valor',
        'Data de fechamento esperada',
        'Feeling',
        'Origem do Negócio',
        'Time de Vendas',
        'Time de Vendas 2',
      ],
      options: {
        2: ['Muito bom', 'Bom', 'Neutro', 'Ruim'],
        3: ['Indicação', 'Site', 'Evento', 'Prospecção', 'Outro'],
        4: ['Comercial', 'Parcerias'],
        5: ['Comercial', 'Parcerias'],
      },
      organizations: [
        {
          name: 'INDUSTRIAL NOVA ERA LTDA',
          fantasy_name: 'NOVA ERA',
          cnpj: '12.345.678/0001-90',
          status: 'LEAD',
          system: 'TOTVS RM',
          segment: 'INDÚSTRIA',
        },
        {
          name: 'COMERCIAL HORIZONTE S.A.',
          fantasy_name: 'HORIZONTE',
          cnpj: '98.765.432/0001-10',
          status: 'EM NEGOCIAÇÃO',
          system: 'SAP B1',
          segment: 'VAREJO',
        },
      ],
      contacts: [
        {
          name: 'Marina Alves',
          phone: '(11) 98765-4321',
          phone_type: 'Celular',
          email: 'marina.alves@novaera.com.br',
          email_type: 'Comercial',
          organizationIndex: 0,
        },
        {
          name: 'Ricardo Nunes',
          phone: '(21) 99876-5432',
          phone_type: 'Celular',
          email: 'ricardo.nunes@horizonte.com.br',
          email_type: 'Comercial',
          organizationIndex: 1,
        },
      ],
      cards: [
        {
          title: 'NOVA ERA — primeiro contato',
          description: 'Interesse registrado após captação de Lead. Troque por um negócio real.',
        },
        {
          title: 'HORIZONTE — proposta enviada',
          description: 'Proposta enviada e em análise pelo cliente. Acompanhe o retorno pelo campo Feeling.',
        },
      ],
    },
    projects: {
      name: 'Projetos',
      description: 'Fases, entregas e acompanhamento',
      board: 'Projeto',
      columns: ['Backlog', 'Planejamento', 'Em andamento', 'Em revisão', 'Concluído'],
      labels: ['Crítico', 'Prioritário', 'Melhoria'],
      fields: ['Prioridade', 'Tipo de Projeto', 'Número da Proposta'],
      options: {
        0: ['Alta', 'Média', 'Baixa'],
        1: ['Implantação', 'Melhoria', 'Integração', 'Migração', 'Suporte', 'Outro'],
      },
      cards: [
        {
          title: 'Projeto Exemplo — cronograma modelo',
          description:
            'Cada card é um projeto. Vincule o Cliente (Organização e pessoa de contato), preencha Tipo de Projeto e Número da Proposta e abra o cronograma do projeto para digitar as durações — as datas se montam sozinhas. Duplique este card para abrir um projeto novo: o cronograma modelo vai junto.',
          checklist: {
            title: 'Marcos do projeto',
            items: [
              'Reunião de abertura',
              'Documentação inicial',
              'Status report',
              'Go-live',
              'Finalização',
            ],
          },
          schedule: [
            'INICIAÇÃO',
            'Entrada',
            'Kick off',
            'Especificações e Documentações',
            "Análise de Gap's",
            'Validação e Aceite',
            'EXECUÇÃO',
            'Desenvolvimento do escopo',
            'Testes de qualidade',
            'Capacitações',
            'Protótipo isolado e integrado',
            'Testes unitários / teste conjunto',
            'HOMOLOGAÇÃO',
            'Montagem do Roteiro de testes',
            'Homologação',
            'Ajustes',
            'GO? NO GO?',
            'PRODUÇÃO',
            'Operação Assistida',
            'Tarefas e Pendências',
            'FINALIZAÇÃO',
            'Lições aprendidas',
            'Termo de Finalização',
          ],
        },
        {
          title: 'Levantamento de requisitos',
          description: 'Entrevistas, documentação e validação do que precisa ser entregue.',
        },
      ],
    },
    tasks: {
      name: 'Tarefas',
      description: 'A fazer, fazendo e concluído',
      board: 'Minhas Tarefas',
      columns: ['A fazer', 'Fazendo', 'Concluído'],
      labels: ['Urgente', 'Importante', 'Rotina'],
      fields: ['Prioridade'],
      options: { 0: ['Alta', 'Média', 'Baixa'] },
      cards: [
        {
          title: 'Exemplo de tarefa com checklist',
          description: 'Use o checklist para acompanhar o avanço em %.',
          checklist: { title: 'Passos', items: ['Primeiro passo', 'Segundo passo', 'Terceiro passo'] },
        },
        { title: 'Tarefa em andamento', description: 'Arraste os cards entre as colunas conforme avança.' },
      ],
    },
  },

  en: {
    crm: {
      name: 'CRM / Sales Pipeline',
      description: 'Leads, proposals and closing',
      board: 'Sales Pipeline',
      columns: ['Leads', 'Contacted', 'Proposal sent', 'Negotiation', 'Won', 'Lost'],
      labels: ['Hot', 'Warm', 'Cold'],
      fields: [
        'Value',
        'Expected close date',
        'Feeling',
        'Deal source',
        'Sales team',
        'Sales team 2',
      ],
      options: {
        2: ['Very good', 'Good', 'Neutral', 'Poor'],
        3: ['Referral', 'Website', 'Event', 'Outbound', 'Other'],
        4: ['Sales', 'Partnerships'],
        5: ['Sales', 'Partnerships'],
      },
      organizations: [
        {
          name: 'NEW ERA INDUSTRIAL LTD',
          fantasy_name: 'NEW ERA',
          cnpj: '12.345.678/0001-90',
          status: 'LEAD',
          system: 'TOTVS RM',
          segment: 'MANUFACTURING',
        },
        {
          name: 'HORIZON TRADING INC.',
          fantasy_name: 'HORIZON',
          cnpj: '98.765.432/0001-10',
          status: 'IN NEGOTIATION',
          system: 'SAP B1',
          segment: 'RETAIL',
        },
      ],
      contacts: [
        {
          name: 'Marina Alves',
          phone: '+55 11 98765-4321',
          phone_type: 'Mobile',
          email: 'marina.alves@newera.example',
          email_type: 'Work',
          organizationIndex: 0,
        },
        {
          name: 'Richard Nunes',
          phone: '+55 21 99876-5432',
          phone_type: 'Mobile',
          email: 'richard.nunes@horizon.example',
          email_type: 'Work',
          organizationIndex: 1,
        },
      ],
      cards: [
        {
          title: 'NEW ERA — first contact',
          description: 'Interest registered after lead capture. Replace with a real deal.',
        },
        {
          title: 'HORIZON — proposal sent',
          description: 'Proposal sent and under review by the client. Track the response in the Feeling field.',
        },
      ],
    },
    projects: {
      name: 'Projects',
      description: 'Phases, deliverables and tracking',
      board: 'Project',
      columns: ['Backlog', 'Planning', 'In progress', 'In review', 'Done'],
      labels: ['Critical', 'Priority', 'Improvement'],
      fields: ['Priority', 'Project type', 'Proposal number'],
      options: {
        0: ['High', 'Medium', 'Low'],
        1: ['Rollout', 'Improvement', 'Integration', 'Migration', 'Support', 'Other'],
      },
      cards: [
        {
          title: 'Sample project — model schedule',
          description:
            'Every card is a project. Link the Client (organization and contact person), fill in Project type and Proposal number, then open the project schedule and type the durations — the dates build themselves. Duplicate this card to start a new project: the model schedule comes along.',
          checklist: {
            title: 'Project milestones',
            items: ['Kick-off meeting', 'Initial documentation', 'Status report', 'Go-live', 'Closing'],
          },
          schedule: [
            'INITIATION',
            'Intake',
            'Kick off',
            'Specifications and documentation',
            'Gap analysis',
            'Validation and sign-off',
            'EXECUTION',
            'Scope development',
            'Quality testing',
            'Training',
            'Standalone and integrated prototype',
            'Unit tests / joint test',
            'ACCEPTANCE',
            'Test script preparation',
            'Acceptance testing',
            'Adjustments',
            'GO? NO GO?',
            'PRODUCTION',
            'Assisted operation',
            'Tasks and open items',
            'CLOSING',
            'Lessons learned',
            'Closing statement',
          ],
        },
        {
          title: 'Requirements gathering',
          description: 'Interviews, documentation and validation of what must be delivered.',
        },
      ],
    },
    tasks: {
      name: 'Tasks',
      description: 'To do, doing and done',
      board: 'My Tasks',
      columns: ['To do', 'Doing', 'Done'],
      labels: ['Urgent', 'Important', 'Routine'],
      fields: ['Priority'],
      options: { 0: ['High', 'Medium', 'Low'] },
      cards: [
        {
          title: 'Sample task with checklist',
          description: 'Use the checklist to track progress as a percentage.',
          checklist: { title: 'Steps', items: ['First step', 'Second step', 'Third step'] },
        },
        { title: 'Task in progress', description: 'Drag cards between columns as work moves forward.' },
      ],
    },
  },

  es: {
    crm: {
      name: 'CRM / Embudo de Ventas',
      description: 'Leads, propuestas y cierre',
      board: 'Embudo de Ventas',
      columns: ['Leads', 'Contactado', 'Propuesta enviada', 'Negociación', 'Ganado', 'Perdido'],
      labels: ['Caliente', 'Tibio', 'Frío'],
      fields: [
        'Valor',
        'Fecha de cierre esperada',
        'Feeling',
        'Origen del negocio',
        'Equipo de ventas',
        'Equipo de ventas 2',
      ],
      options: {
        2: ['Muy bueno', 'Bueno', 'Neutral', 'Malo'],
        3: ['Referencia', 'Sitio web', 'Evento', 'Prospección', 'Otro'],
        4: ['Ventas', 'Alianzas'],
        5: ['Ventas', 'Alianzas'],
      },
      organizations: [
        {
          name: 'INDUSTRIAL NUEVA ERA LTDA',
          fantasy_name: 'NUEVA ERA',
          cnpj: '12.345.678/0001-90',
          status: 'LEAD',
          system: 'TOTVS RM',
          segment: 'INDUSTRIA',
        },
        {
          name: 'COMERCIAL HORIZONTE S.A.',
          fantasy_name: 'HORIZONTE',
          cnpj: '98.765.432/0001-10',
          status: 'EN NEGOCIACIÓN',
          system: 'SAP B1',
          segment: 'RETAIL',
        },
      ],
      contacts: [
        {
          name: 'Marina Alves',
          phone: '+55 11 98765-4321',
          phone_type: 'Celular',
          email: 'marina.alves@nuevaera.example',
          email_type: 'Comercial',
          organizationIndex: 0,
        },
        {
          name: 'Ricardo Nunes',
          phone: '+55 21 99876-5432',
          phone_type: 'Celular',
          email: 'ricardo.nunes@horizonte.example',
          email_type: 'Comercial',
          organizationIndex: 1,
        },
      ],
      cards: [
        {
          title: 'NUEVA ERA — primer contacto',
          description: 'Interés registrado tras la captación del lead. Reemplaza por un negocio real.',
        },
        {
          title: 'HORIZONTE — propuesta enviada',
          description: 'Propuesta enviada y en análisis por el cliente. Sigue la respuesta en el campo Feeling.',
        },
      ],
    },
    projects: {
      name: 'Proyectos',
      description: 'Fases, entregas y seguimiento',
      board: 'Proyecto',
      columns: ['Backlog', 'Planificación', 'En curso', 'En revisión', 'Completado'],
      labels: ['Crítico', 'Prioritario', 'Mejora'],
      fields: ['Prioridad', 'Tipo de proyecto', 'Número de propuesta'],
      options: {
        0: ['Alta', 'Media', 'Baja'],
        1: ['Implantación', 'Mejora', 'Integración', 'Migración', 'Soporte', 'Otro'],
      },
      cards: [
        {
          title: 'Proyecto Ejemplo — cronograma modelo',
          description:
            'Cada tarjeta es un proyecto. Vincula el Cliente (organización y persona de contacto), completa Tipo de proyecto y Número de propuesta y abre el cronograma del proyecto para escribir las duraciones — las fechas se arman solas. Duplica esta tarjeta para abrir un proyecto nuevo: el cronograma modelo va incluido.',
          checklist: {
            title: 'Hitos del proyecto',
            items: [
              'Reunión de apertura',
              'Documentación inicial',
              'Status report',
              'Go-live',
              'Finalización',
            ],
          },
          schedule: [
            'INICIACIÓN',
            'Entrada',
            'Kick off',
            'Especificaciones y documentación',
            'Análisis de gaps',
            'Validación y aceptación',
            'EJECUCIÓN',
            'Desarrollo del alcance',
            'Pruebas de calidad',
            'Capacitaciones',
            'Prototipo aislado e integrado',
            'Pruebas unitarias / prueba conjunta',
            'HOMOLOGACIÓN',
            'Armado del guion de pruebas',
            'Homologación',
            'Ajustes',
            '¿GO? ¿NO GO?',
            'PRODUCCIÓN',
            'Operación asistida',
            'Tareas y pendientes',
            'FINALIZACIÓN',
            'Lecciones aprendidas',
            'Acta de finalización',
          ],
        },
        {
          title: 'Levantamiento de requisitos',
          description: 'Entrevistas, documentación y validación de lo que hay que entregar.',
        },
      ],
    },
    tasks: {
      name: 'Tareas',
      description: 'Por hacer, haciendo y hecho',
      board: 'Mis Tareas',
      columns: ['Por hacer', 'Haciendo', 'Hecho'],
      labels: ['Urgente', 'Importante', 'Rutina'],
      fields: ['Prioridad'],
      options: { 0: ['Alta', 'Media', 'Baja'] },
      cards: [
        {
          title: 'Tarea de ejemplo con checklist',
          description: 'Usa el checklist para seguir el avance en %.',
          checklist: { title: 'Pasos', items: ['Primer paso', 'Segundo paso', 'Tercer paso'] },
        },
        { title: 'Tarea en curso', description: 'Arrastra las tarjetas entre columnas según avanzas.' },
      ],
    },
  },
};

const ORDER: TemplateId[] = ['crm', 'projects', 'tasks'];

/** Devolve os templates já montados no idioma atual (cai para PT se não houver). */
export function getTemplates(language?: string): TemplateDef[] {
  const base = (language ?? 'pt').split('-')[0];
  const lang: Lang = base === 'en' || base === 'es' ? base : 'pt';

  return ORDER.map((id) => {
    const text = TEXT[lang][id];
    const shape = SHAPE[id];
    return {
      id,
      name: text.name,
      description: text.description,
      boardName: text.board,
      columns: text.columns.map((title, i) => ({ title, color: shape.columnColors[i] ?? '#6366F1' })),
      labels: text.labels.map((name, i) => ({ name, color: shape.labelColors[i] ?? '#6366F1' })),
      fields: text.fields.map((name, i) => ({
        name,
        type: shape.fieldTypes[i] ?? 'text',
        options: text.options?.[i],
        showOnFace: shape.fieldShowOnFace[i] ?? false,
        money: shape.fieldMoney?.[i] ?? false,
      })),
      organizations: text.organizations,
      contacts: text.contacts,
      cards: text.cards.map((card, i) => {
        const indents = shape.cardScheduleIndents?.[i];
        const durations = shape.cardScheduleDurations?.[i];
        const client = shape.cardClients?.[i];
        const values = shape.cardFieldValues?.[i];

        /** Resolve os valores de exemplo já no idioma certo. */
        let fieldValues: Record<number, string | number | boolean> | undefined;
        if (values) {
          fieldValues = {};
          for (const [key, spec] of Object.entries(values)) {
            const fieldIndex = Number(key);
            if ('option' in spec) {
              const option = text.options?.[fieldIndex]?.[spec.option];
              if (option) fieldValues[fieldIndex] = option;
            } else if ('inDays' in spec) {
              fieldValues[fieldIndex] = dateIn(spec.inDays);
            } else {
              fieldValues[fieldIndex] = spec.value;
            }
          }
        }

        return {
          columnIndex: shape.cardColumns[i] ?? 0,
          title: card.title,
          description: card.description,
          labelIndexes: shape.cardLabels[i] ?? [],
          checklist: card.checklist,
          organizationIndex: client?.organization,
          contactIndex: client?.contact,
          fieldValues,
          schedule: card.schedule?.map((name, step) => ({
            name,
            indent: indents?.[step] ?? 1,
            duration: durations?.[step] ?? null,
          })),
        };
      }),
    };
  });
}
