import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const SoulClawModule = buildModule("SoulClawModule", (m) => {
  const soulClaw = m.contract("SoulClaw");
  return { soulClaw };
});

export default SoulClawModule;
