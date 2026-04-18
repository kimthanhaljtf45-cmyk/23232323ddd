/**
 * ROLE ROUTER - Централізована логіка маршрутизації за ролями
 * 
 * Ця утиліта забезпечує масштабованість на 100+ залів (SaaS)
 * та підтримку multi-role користувачів у майбутньому.
 */

export type UserRole = 'PARENT' | 'STUDENT' | 'COACH' | 'OWNER' | 'ADMIN';

export interface RouteConfig {
  homeRoute: string;
  tabsRoute: string;
  profileRoute: string;
  canAccessAdmin: boolean;
  canAccessCoach: boolean;
  canAccessOwner: boolean;
}

/**
 * Отримати головний маршрут для ролі
 */
export function getHomeRoute(role: string | undefined): string {
  switch (role) {
    case 'ADMIN':
      return '/(admin)';
    case 'OWNER':
      return '/(owner)';
    case 'COACH':
      return '/(coach)';
    case 'STUDENT':
      return '/(student)';
    case 'PARENT':
    default:
      return '/(tabs)';
  }
}

/**
 * Отримати повну конфігурацію маршрутів для ролі
 */
export function getRouteConfig(role: string | undefined): RouteConfig {
  switch (role) {
    case 'ADMIN':
      return {
        homeRoute: '/(admin)',
        tabsRoute: '/(admin)',
        profileRoute: '/admin/profile',
        canAccessAdmin: true,
        canAccessCoach: true,
        canAccessOwner: true,
      };
    case 'OWNER':
      return {
        homeRoute: '/(owner)',
        tabsRoute: '/(owner)',
        profileRoute: '/profile',
        canAccessAdmin: false,
        canAccessCoach: true,
        canAccessOwner: true,
      };
    case 'COACH':
      return {
        homeRoute: '/(coach)',
        tabsRoute: '/(coach)',
        profileRoute: '/coach/profile',
        canAccessAdmin: false,
        canAccessCoach: true,
        canAccessOwner: false,
      };
    case 'STUDENT':
      return {
        homeRoute: '/(student)',
        tabsRoute: '/(student)',
        profileRoute: '/(student)/profile',
        canAccessAdmin: false,
        canAccessCoach: false,
        canAccessOwner: false,
      };
    case 'PARENT':
    default:
      return {
        homeRoute: '/(tabs)',
        tabsRoute: '/(tabs)',
        profileRoute: '/(tabs)/profile',
        canAccessAdmin: false,
        canAccessCoach: false,
        canAccessOwner: false,
      };
  }
}

/**
 * Перевірити доступ до маршруту
 */
export function canAccessRoute(
  role: string | undefined,
  route: string
): boolean {
  const config = getRouteConfig(role);

  if (route.startsWith('/(admin)') || route.startsWith('/admin')) {
    return config.canAccessAdmin;
  }

  if (route.startsWith('/(owner)') || route.startsWith('/owner')) {
    return config.canAccessOwner;
  }

  if (route.startsWith('/(coach)') || route.startsWith('/coach')) {
    return config.canAccessCoach || config.canAccessAdmin;
  }

  return true;
}

/**
 * Отримати редірект якщо немає доступу
 */
export function getAccessDeniedRedirect(role: string | undefined): string {
  return getHomeRoute(role);
}
