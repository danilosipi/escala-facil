export const dynamic = "force-dynamic";

import { Navbar, PageContainer, Card } from "@/components/ui";
import { ensureStoreConfig } from "@/services/store.service";
import { saveStoreConfigAction } from "@/actions/store.actions";
import { listEmployees } from "@/services/employee.service";
import { listShifts } from "@/services/shift.service";
import { StoreConfigForm } from "@/components/configuracoes/StoreConfigForm";

export default async function ConfiguracoesPage() {
  const config = await ensureStoreConfig();
  const employees = await listEmployees();
  const shifts = await listShifts();
  const activeEmployees = employees.filter((e) => e.active);
  const activeShifts = shifts.filter((s) => s.active).length;

  return (
    <>
      <Navbar currentPath="/configuracoes" />
      <PageContainer
        title="Configurações da loja"
        description="Parametrize horários, regras de escala e cobertura mínima"
      >
        <Card>
          <StoreConfigForm
            config={config}
            employees={activeEmployees}
            activeShifts={activeShifts}
            saveAction={saveStoreConfigAction}
          />
        </Card>
      </PageContainer>
    </>
  );
}
