import { Role } from '@cloud-stock/shared';

export function getDefaultRouteForRole(role: Role | null | undefined): string {
  switch (role) {
    case Role.ADMIN:
      return '/dashboard';
    case Role.MANAGER:
      return '/dashboard';
    case Role.STAFF:
      return '/dashboard';
    default:
      return '/login';
  }
}

export function getSafeRedirectPath(
  fromPathname: string | undefined,
  role: Role | null | undefined
): string {
  const defaultRoute = getDefaultRouteForRole(role);
  if (!fromPathname || fromPathname === '/' || fromPathname === '/login') {
    return defaultRoute;
  }

  // Prevent STAFF from being bounced into restricted admin/manager routes
  if (
    (fromPathname.startsWith('/audit-logs') || fromPathname.startsWith('/system')) &&
    role !== Role.ADMIN
  ) {
    return defaultRoute;
  }

  if (
    (fromPathname.startsWith('/users') || fromPathname.startsWith('/approvals')) &&
    role !== Role.ADMIN &&
    role !== Role.MANAGER
  ) {
    return defaultRoute;
  }

  return fromPathname;
}

