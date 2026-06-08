# Escala Fácil

Sistema web para geração e visualização de escala de funcionários, com regras de jornada **5x2**, cobertura mínima por turno e preferências de folga.

## Funcionalidades

- Cadastro de **funcionários** (preferências de folga, indisponibilidades, restrição de fim de semana)
- Cadastro de **turnos** (Manhã, Tarde, etc.)
- **Configuração da loja** (dias operacionais, mínimo por turno, ciclo de escala)
- **Diagnóstico de capacidade** — indica se a equipe consegue cobrir os turnos mínimos
- **Geração mensal de escala** com validação de conflitos e avisos explicativos
- Visualização em tabela e calendário

## Stack

- [Next.js 16](https://nextjs.org) (App Router)
- React 19
- Prisma + SQLite (`better-sqlite3`)
- TypeScript + Tailwind CSS

## Pré-requisitos

- Node.js 20+
- npm

## Instalação

```bash
npm install
```

Configure a variável de ambiente (opcional — o padrão já funciona em desenvolvimento):

```env
DATABASE_URL="file:./prisma/dev.db"
```

Prepare o banco de dados:

```bash
npm run db:migrate
npm run db:seed   # opcional: dados de exemplo
```

## Executando

```bash
npm run dev
```

A aplicação sobe em [http://localhost:3010](http://localhost:3010).

Outros comandos úteis:

```bash
npm run build      # build de produção
npm run start      # servidor de produção
npm run test       # testes do algoritmo de escala
npm run lint       # ESLint
npm run db:reset   # recria o banco (apaga dados)
```

## Fluxo recomendado no app

1. [Funcionários](/funcionarios) — cadastrar equipe e preferências
2. [Turnos](/turnos) — definir horários
3. [Configurações](/configuracoes) — validar regras e capacidade da loja
4. [Escala](/escala) — gerar e revisar o mês

## Algoritmo de geração de escala

A lógica principal fica em `src/domain/`. O fluxo ao gerar uma escala mensal é:

### 1. Geração inicial

Monta planos de trabalho/folga por ciclo respeitando:

- regra **5x2** (5 dias trabalhados, 2 folgas por ciclo de 7 dias)
- **cobertura diária** mínima
- **mínimo de funcionários por turno**
- **indisponibilidades** obrigatórias
- restrição de **fim de semana** (`canWorkWeekend`)
- dias preferenciais de folga, quando a capacidade permitir

Em seguida, distribui turnos e repara cobertura dentro de cada ciclo.

### 2. Otimização de preferências (remanejamento)

Etapa pós-geração (`preferred-off-optimizer.ts`). Para cada preferência de folga ainda não atendida, o sistema tenta **trocar dias de trabalho/folga** entre dois funcionários no **mesmo ciclo**:

- o funcionário que queria folgar deixa de trabalhar naquele dia
- outro funcionário que estava de folga cobre o dia
- o primeiro compensa assumindo um dia de trabalho do cobridor

A troca só é aplicada se **todos** continuarem válidos:

| Regra | Exigência |
| --- | --- |
| Jornada | exatamente 5 dias trabalhados e 2 folgas no ciclo |
| Cobertura | nenhum dia ou turno descoberto |
| Indisponibilidade | ninguém escalado em dia bloqueado |
| Fim de semana | respeita `canWorkWeekend` |
| Turnos | ninguém com dois turnos no mesmo dia |

Se nenhuma troca viável existir, registra aviso:

> *Preferência não atendida por impossibilidade de remanejamento sem violar cobertura ou 5x2.*

### 3. Validação final

Confere integridade da escala (5x2, cobertura, indisponibilidades, etc.) e consolida conflitos/avisos exibidos na UI.

## Debug do algoritmo

Logs detalhados do remanejamento vão para o **console do servidor** (não aparecem na interface):

```bash
# Windows (PowerShell)
$env:SCHEDULE_DEBUG="1"; npm run dev

# Linux / macOS
SCHEDULE_DEBUG=1 npm run dev
```

Com a flag ativa, o prefixo `[preferencia-remanejamento]` registra:

- preferência analisada
- candidatos à troca
- motivo de rejeição de cada candidato
- troca aplicada ou motivo final da não aplicação

## Testes

Os testes cobrem preferências de folga, remanejamento e restrições de fim de semana:

```bash
npm test
```

Arquivos principais:

- `src/domain/preferred-off.test.ts`
- `src/domain/schedule-weekend.test.ts`

## Estrutura do projeto

```
src/
  app/              # páginas (Next.js App Router)
  components/       # UI e formulários
  domain/           # algoritmo de escala, validações e testes
  services/         # acesso a dados (Prisma)
  actions/          # server actions
prisma/             # schema, migrations e seed
```

## Docker (opcional)

```bash
docker compose up --build
```

O container expõe a porta **3000** e persiste o SQLite em volume.

## Licença

Projeto privado.
