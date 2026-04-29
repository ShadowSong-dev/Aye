import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("AuditLogFactoryModule", (m) => {

  const AuditLogFactory = m.contract("AuditLogFactory");

  return { AuditLogFactory };
});
