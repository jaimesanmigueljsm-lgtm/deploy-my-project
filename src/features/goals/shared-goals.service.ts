import {
  getUserFamilies,
  loadFamilyData,
  createSharedGoal,
  updateSharedGoal,
  addGoalContribution,
  type SharedGoal,
  type UserFamily,
} from "@/features/family/family.service";

export type { SharedGoal, UserFamily };
export {
  getUserFamilies,
  loadFamilyData,
  createSharedGoal,
  updateSharedGoal,
  addGoalContribution,
};
