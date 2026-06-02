import {
  getUserFamilies,
  loadFamilyData,
  createSharedGoal,
  updateSharedGoal,
  addGoalContribution,
  createFamily,
  searchUserByUsername,
  sendFamilyInvite,
  leaveFamilyGroup,
  type SharedGoal,
  type UserFamily,
  type UserSearchResult,
} from "@/features/family/family.service";

export type { SharedGoal, UserFamily, UserSearchResult };
export {
  getUserFamilies,
  loadFamilyData,
  createSharedGoal,
  updateSharedGoal,
  addGoalContribution,
  createFamily,
  searchUserByUsername,
  sendFamilyInvite,
  leaveFamilyGroup,
};
