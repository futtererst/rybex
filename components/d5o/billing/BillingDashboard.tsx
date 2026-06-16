import { ApprovedNotBilledQueue } from "./ApprovedNotBilledQueue";
import { BillingBackupPanel } from "./BillingBackupPanel";
import { BillingReadinessCard } from "./BillingReadinessCard";
import { CashAtRiskCard } from "./CashAtRiskCard";
import { CommercialExposurePanel } from "./CommercialExposurePanel";
import { PayApplicationCard } from "./PayApplicationCard";
import { PayApplicationRegister } from "./PayApplicationRegister";
import { PaymentAgingPanel } from "./PaymentAgingPanel";
import { RetainageLienWaiverPanel } from "./RetainageLienWaiverPanel";
import { ScheduleOfValuesTable } from "./ScheduleOfValuesTable";
import type {
  BillingBackupItem,
  ChangeEvent,
  CommercialExposureItem,
  LienWaiver,
  PayApplication,
  ScheduleOfValueLine
} from "@/lib/d5o/types";

export function BillingDashboard({
  payApplications,
  scheduleOfValues,
  backupItems,
  lienWaivers,
  commercialExposure,
  changeEvents
}: {
  payApplications: PayApplication[];
  scheduleOfValues: ScheduleOfValueLine[];
  backupItems: BillingBackupItem[];
  lienWaivers: LienWaiver[];
  commercialExposure: CommercialExposureItem[];
  changeEvents: ChangeEvent[];
}) {
  return (
    <>
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Pay Application Register</p>
            <h2>Billing status, backup, waivers, and payment follow-up</h2>
          </div>
          <span className="muted">{payApplications.length} pay applications</span>
        </div>
        <PayApplicationRegister payApplications={payApplications} />
      </section>

      <div className="content-grid">
        <CashAtRiskCard
          payApplications={payApplications}
          backupItems={backupItems}
          lienWaivers={lienWaivers}
          commercialExposure={commercialExposure}
          changeEvents={changeEvents}
        />
        <BillingReadinessCard
          payApplications={payApplications}
          backupItems={backupItems}
          lienWaivers={lienWaivers}
          commercialExposure={commercialExposure}
          changeEvents={changeEvents}
        />
      </div>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Billing Readiness by Project</p>
            <h2>Current pay applications needing action</h2>
          </div>
        </div>
        <div className="project-detail-grid">
          {payApplications.map((payApplication) => (
            <PayApplicationCard key={payApplication.id} payApplication={payApplication} />
          ))}
        </div>
      </section>

      <div className="operating-columns">
        <ApprovedNotBilledQueue changeEvents={changeEvents} />
        <BillingBackupPanel backupItems={backupItems} />
        <RetainageLienWaiverPanel payApplications={payApplications} lienWaivers={lienWaivers} />
        <PaymentAgingPanel payApplications={payApplications} />
        <CommercialExposurePanel commercialExposure={commercialExposure} />
      </div>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Schedule of Values</p>
            <h2>Quantity and progress billing support</h2>
          </div>
          <span className="muted">{scheduleOfValues.length} SOV lines</span>
        </div>
        <ScheduleOfValuesTable lines={scheduleOfValues} />
      </section>
    </>
  );
}
