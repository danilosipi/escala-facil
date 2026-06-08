import Link from "next/link";
import { Navbar, PageContainer, Card, Alert } from "@/components/ui";
import { ensureStoreConfig } from "@/services/store.service";
import { listEmployees } from "@/services/employee.service";
import { listShifts } from "@/services/shift.service";
import { listSchedules } from "@/services/schedule.service";
import { buildScheduleCapacityFromConfig } from "@/domain/schedule-capacity";

export default async function HomePage() {
  const config = await ensureStoreConfig();
  const employees = await listEmployees();
  const shifts = await listShifts();
  const schedules = await listSchedules();

  const activeEmployees = employees.filter((e) => e.active).length;
  const activeShifts = shifts.filter((s) => s.active).length;
  const diagnosis = buildScheduleCapacityFromConfig(
    config,
    employees.filter((e) => e.active),
    activeShifts
  );

  return (
    <>
      <Navbar currentPath="/" />
      <PageContainer
        title={`Bem-vindo ao ${config.name}`}
        description="Sistema de geração e visualização de escala de funcionários"
      >
        <Alert variant="info" >
          Cadastre primeiro os funcionários e turnos. Depois configure a loja para validar se a
          equipe é suficiente.
        </Alert>

        <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <p className="text-sm text-slate-500">Funcionários ativos</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{activeEmployees}</p>
          </Card>
          <Card>
            <p className="text-sm text-slate-500">Turnos ativos</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{activeShifts}</p>
          </Card>
          <Card>
            <p className="text-sm text-slate-500">Regra de escala</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {config.workDaysPerCycle}x{config.offDaysPerCycle}
            </p>
            <p className="text-xs text-slate-500">ciclo de {config.cycleLengthDays} dias</p>
          </Card>
          <Card>
            <p className="text-sm text-slate-500">Escalas geradas</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{schedules.length}</p>
          </Card>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <Card>
            <h2 className="text-lg font-semibold text-slate-900">Capacidade da escala</h2>
            <dl className="mt-3 space-y-2 text-sm text-slate-600">
              <div className="flex justify-between">
                <dt>Jornadas disponíveis no ciclo</dt>
                <dd className="font-medium text-slate-900">{diagnosis.availableCapacity}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Jornadas necessárias no ciclo</dt>
                <dd className="font-medium text-slate-900">{diagnosis.minimumRequired}</dd>
              </div>
              <div className="flex justify-between">
                <dt>{diagnosis.isSufficient ? "Sobra" : "Déficit"}</dt>
                <dd
                  className={`font-medium ${diagnosis.isSufficient ? "text-green-700" : "text-amber-700"}`}
                >
                  {diagnosis.isSufficient ? diagnosis.surplus : diagnosis.deficit}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-sm">
              {diagnosis.isSufficient ? (
                <span className="text-green-700">Capacidade suficiente para os turnos mínimos.</span>
              ) : (
                <span className="text-amber-700">
                  Capacidade insuficiente — alguns turnos ficarão descobertos.
                </span>
              )}
            </p>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-slate-900">Fluxo recomendado</h2>
            <ol className="mt-3 list-inside list-decimal space-y-2 text-sm">
              <li>
                <Link href="/funcionarios" className="text-blue-600 hover:underline">
                  Cadastrar funcionários
                </Link>
              </li>
              <li>
                <Link href="/turnos" className="text-blue-600 hover:underline">
                  Configurar turnos
                </Link>
              </li>
              <li>
                <Link href="/configuracoes" className="text-blue-600 hover:underline">
                  Validar configurações da loja
                </Link>
              </li>
              <li>
                <Link href="/escala" className="text-blue-600 hover:underline">
                  Gerar e visualizar escala
                </Link>
              </li>
            </ol>
          </Card>
        </div>
      </PageContainer>
    </>
  );
}
