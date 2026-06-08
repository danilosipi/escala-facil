import { Navbar, PageContainer, Card, Badge } from "@/components/ui";
import { listShifts } from "@/services/shift.service";
import { ShiftForm } from "@/components/turnos/ShiftForm";
import { ShiftActions } from "@/components/turnos/ShiftActions";
import { formatDuration } from "@/lib/utils";

export default async function TurnosPage() {
  const shifts = await listShifts();

  return (
    <>
      <Navbar currentPath="/turnos" />
      <PageContainer title="Turnos" description="Configure os turnos de trabalho da loja">
        <div className="grid gap-8 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <h2 className="mb-4 text-lg font-semibold">Novo turno</h2>
            <ShiftForm />
          </Card>

          <div className="space-y-4 lg:col-span-2">
            {shifts.length === 0 ? (
              <Card>
                <p className="text-slate-600">Nenhum turno cadastrado.</p>
              </Card>
            ) : (
              shifts.map((shift) => (
                <Card key={shift.id}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-slate-900">{shift.name}</h3>
                        <Badge variant={shift.active ? "success" : "default"}>
                          {shift.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {shift.startTime} às {shift.endTime} ({formatDuration(shift.durationMinutes)})
                      </p>
                    </div>
                    <ShiftActions shift={shift} />
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </PageContainer>
    </>
  );
}
