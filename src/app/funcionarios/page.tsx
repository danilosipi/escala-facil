export const dynamic = "force-dynamic";

import { Navbar, PageContainer, Card, Badge } from "@/components/ui";
import { listEmployees } from "@/services/employee.service";
import { EmployeeForm } from "@/components/funcionarios/EmployeeForm";
import { EmployeeActions } from "@/components/funcionarios/EmployeeActions";
import { DAY_NAMES } from "@/lib/utils";

export default async function FuncionariosPage() {
  const employees = await listEmployees();

  return (
    <>
      <Navbar currentPath="/funcionarios" />
      <PageContainer
        title="Funcionários"
        description="Cadastre e gerencie os funcionários da loja"
      >
        <div className="grid gap-8 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <h2 className="mb-4 text-lg font-semibold">Novo funcionário</h2>
            <EmployeeForm />
          </Card>

          <div className="space-y-4 lg:col-span-2">
            {employees.length === 0 ? (
              <Card>
                <p className="text-slate-600">Nenhum funcionário cadastrado.</p>
              </Card>
            ) : (
              employees.map((employee) => (
                <Card key={employee.id}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-slate-900">{employee.name}</h3>
                        <Badge variant={employee.active ? "success" : "default"}>
                          {employee.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      {employee.notes && (
                        <p className="mt-1 text-sm text-slate-600">{employee.notes}</p>
                      )}
                      <div className="mt-2 space-y-1 text-sm text-slate-500">
                        <p>
                          Folgas preferenciais:{" "}
                          {employee.preferredOffDays.length > 0
                            ? employee.preferredOffDays.map((d) => DAY_NAMES[d]).join(", ")
                            : "Nenhuma"}
                        </p>
                        <p>
                          Indisponível em:{" "}
                          {employee.unavailableDates.length > 0
                            ? employee.unavailableDates.join(", ")
                            : "Nenhuma data"}
                        </p>
                        <p>
                          Fim de semana: {employee.canWorkWeekend ? "Pode trabalhar" : "Não pode"}
                        </p>
                      </div>
                    </div>
                    <EmployeeActions employee={employee} />
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
