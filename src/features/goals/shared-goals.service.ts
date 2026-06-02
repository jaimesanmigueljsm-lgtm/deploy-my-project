import {
  getUserGoalGroups,
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
  getUserGoalGroups as getUserFamilies,
  loadFamilyData,
  createSharedGoal,
  updateSharedGoal,
  addGoalContribution,
  searchUserByUsername,
  sendFamilyInvite,
  leaveFamilyGroup,
};

export async function createGoalsGroup(name: string): Promise<string> {
  return createFamily("", name, "goals");
}
