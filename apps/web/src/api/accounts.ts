import { api } from "../lib/api";

export type OrgRole = "owner" | "admin" | "member" | "analyst" | "employee";

export interface UserOrg {
  organization_id: string;
  organization_name: string;
  role: OrgRole;
}

export interface UserSystem {
  is_staff: boolean;
  is_superuser: boolean;
}

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  date_joined: string;
  last_login: string | null;
  system: UserSystem;
  orgs: UserOrg[];
}

export interface Invitation {
  id: number;
  email: string;
  organization: { id: string; name: string };
  role: OrgRole;
  status: "pending" | "accepted" | "expired" | "revoked";
  created_at: string;
  expires_at: string;
  created_by: { id: number; email: string };
  invite_url?: string;
}

export const accountsApi = {
  listUsers: (params: Record<string, string> = {}) =>
    api.listAccountsUsers(params).then((r) => r),
  getUser: (id: number) => api.getAccountsUser(id).then((r) => r),
  createUser: (body: {
    email: string;
    first_name?: string;
    last_name?: string;
    is_staff?: boolean;
    is_superuser?: boolean;
  }) => api.createAccountsUser(body).then((r) => r),
  updateUser: (id: number, body: Partial<User>) =>
    api.updateAccountsUser(id, body).then((r) => r),
  deactivateUser: (id: number) => api.deactivateAccountsUser(id),
  resetPassword: (id: number, password: string) =>
    api.resetAccountsUserPassword(id, password).then((r) => r),
  listInvitations: () => api.listAccountsInvitations().then((r) => r),
  createInvitation: (body: { email: string; organization_id: string; role: OrgRole }) =>
    api.createAccountsInvitation(body).then((r) => r),
  resendInvitation: (id: number) => api.resendAccountsInvitation(id).then((r) => r),
  revokeInvitation: (id: number) => api.revokeAccountsInvitation(id),
};
