import { Navbar, PageContainer, Card, Alert } from "@/components/ui";
import { getSchedule } from "@/services/schedule.service";
import { listActiveEmployees } from "@/services/employee.service";
import { listActiveShifts } from "@/services/shift.service";
import { ensureStoreConfig } from "@/services/store.service";
import { generateScheduleAction } from "@/actions/schedule.actions";
import { buildScheduleCapacityFromConfig } from "@/domain/schedule-capacity";
import { ConflictsList } from "@/components/escala/ConflictsList";
import { GenerateScheduleForm } from "@/components/escala/GenerateScheduleForm";
import { ScheduleCalendar } from "@/components/escala/ScheduleCalendar";
import { ScheduleTable } from "@/components/escala/ScheduleTable";

interface PageProps {
  searchParams: Promise<{ month?: string; year?: string }>;
}

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export default async function EscalaPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const now = new Date();
  const month = Number(params.month ?? now.getMonth() + 1);
  const year = Number(params.year ?? now.getFullYear());

  const config = await ensureStoreConfig();
  const schedule = await getSchedule(month, year);
  const employees = await listActiveEmployees();
  const shifts = await listActiveShifts();
  const diagnosis = buildScheduleCapacityFromConfig(config, employees, shifts.length);

  return (
    <>
      <Navbar currentPath="/escala" />
      <PageContainer
        title="Escala mensal"
        description="Gere, visualize e valide a escala de funcionários"
      >
        <Card className="mb-8">
          <GenerateScheduleForm
            month={month}
            year={year}
            diagnosis={diagnosis}
            generateAction={generateScheduleAction}
          />
        </Card>

        {!schedule ? (
          <Card>
            <p className="text-slate-600">
              Nenhuma escala gerada para {MONTH_NAMES[month - 1]} de {year}. Clique em &quot;Gerar
              escala&quot; para criar.
            </p>
            {(diagnosis.deficit > 0 || diagnosis.hasDayOfWeekDeficit) && (
              <div className="mt-4">
                <Alert variant="warning">
                  Antes de gerar, verifique o diagnóstico em{" "}
                  <a href="/configuracoes" className="font-medium underline">
                    Configurações
                  </a>
                  {diagnosis.deficit > 0 && (
                    <>
                      : capacidade {diagnosis.availableCapacity}, necessidade{" "}
                      {diagnosis.minimumRequired}, déficit {diagnosis.deficit}.
                    </>
                  )}
                  {diagnosis.hasDayOfWeekDeficit && (
                    <> Alguns dias da semana não possuem funcionários aptos suficientes.</>
                  )}
                </Alert>
              </div>
            )}
          </Card>
        ) : (
          <div className="space-y-8">
            <Card>
              <h2 className="mb-4 text-lg font-semibold text-slate-900">
                Conflitos — {MONTH_NAMES[month - 1]} {year}
              </h2>
              <ConflictsList conflicts={schedule.conflicts} diagnosis={diagnosis} />
              <p className="mt-4 text-xs text-slate-500">
                Gerada em {schedule.generatedAt.toLocaleString("pt-BR")}
              </p>
            </Card>

            <Card>
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Calendário</h2>
              <ScheduleCalendar
                month={month}
                year={year}
                assignments={schedule.assignments}
                shifts={shifts}
                conflicts={schedule.conflicts}
              />
            </Card>

            <Card>
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Tabela por funcionário</h2>
              <ScheduleTable
                month={month}
                year={year}
                employees={employees}
                assignments={schedule.assignments}
                conflicts={schedule.conflicts}
              />
            </Card>
          </div>
        )}
      </PageContainer>
    </>
  );
}
