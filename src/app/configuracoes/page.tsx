export const dynamic = "force-dynamic";

import { Navbar, PageContainer, Card } from "@/components/ui";
import { ensureStoreConfig } from "@/services/store.service";
import { saveStoreConfigAction } from "@/actions/store.actions";
import { listEmployees } from "@/services/employee.service";
import { listShifts } from "@/services/shift.service";
import { StoreConfigForm } from "@/components/configuracoes/StoreConfigForm";
import { ComplianceDisclaimer } from "@/components/ui/ComplianceDisclaimer";

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
        description="Configure horários da loja, feriados, modelo de escala (5x2 ou 6x1) e cobertura mínima"
      >
        <Card>
          <StoreConfigForm
            config={config}
            employees={activeEmployees}
            activeShifts={activeShifts}
            saveAction={saveStoreConfigAction}
          />
          <ComplianceDisclaimer className="mt-6" />
        </Card>
      </PageContainer>
    </>
  );
}
