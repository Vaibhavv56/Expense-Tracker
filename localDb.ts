/**
 * Temporary local persistence (AsyncStorage) for development / MVP.
 * Swap keys or this module later for a real backend.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const LOCAL_DB = {
  USERS: 'mywallet_users_db_v1',
  CURRENT_USER: 'mywallet_current_user_v1',
  BANKS: 'mywallet_banks_db_v1',
  EXPENSES: 'mywallet_expenses_db_v1',
} as const;

export type LocalDbSnapshot = {
  usersJson: string | null;
  currentUserJson: string | null;
  banksJson: string | null;
  expensesJson: string | null;
};

export async function loadLocalDbSnapshot(): Promise<LocalDbSnapshot> {
  const [usersJson, currentUserJson, banksJson, expensesJson] = await Promise.all([
    AsyncStorage.getItem(LOCAL_DB.USERS),
    AsyncStorage.getItem(LOCAL_DB.CURRENT_USER),
    AsyncStorage.getItem(LOCAL_DB.BANKS),
    AsyncStorage.getItem(LOCAL_DB.EXPENSES),
  ]);
  return { usersJson, currentUserJson, banksJson, expensesJson };
}

export async function saveLocalUsers(json: string): Promise<void> {
  await AsyncStorage.setItem(LOCAL_DB.USERS, json);
}

export async function saveLocalBanks(json: string): Promise<void> {
  await AsyncStorage.setItem(LOCAL_DB.BANKS, json);
}

export async function saveLocalExpenses(json: string): Promise<void> {
  await AsyncStorage.setItem(LOCAL_DB.EXPENSES, json);
}

export async function saveLocalCurrentUser(json: string): Promise<void> {
  await AsyncStorage.setItem(LOCAL_DB.CURRENT_USER, json);
}

export async function clearLocalCurrentUser(): Promise<void> {
  await AsyncStorage.removeItem(LOCAL_DB.CURRENT_USER);
}
