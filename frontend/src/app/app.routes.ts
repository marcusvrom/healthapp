import { Routes } from '@angular/router';
import { authGuard, publicGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },

  {
    path: 'auth',
    canActivate: [publicGuard],
    children: [
      { path: 'login',    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent) },
      { path: 'register', loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent) },
      { path: '', redirectTo: 'login', pathMatch: 'full' },
    ],
  },

  {
    path: 'onboarding',
    canActivate: [authGuard],
    loadComponent: () => import('./features/onboarding/onboarding.component').then(m => m.OnboardingComponent),
  },

  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shared/components/nav-shell.component').then(m => m.NavShellComponent),
    children: [
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'nutrition', loadComponent: () => import('./features/nutrition/nutrition.component').then(m => m.NutritionComponent) },
      { path: 'water',     loadComponent: () => import('./features/water/water-tracker.component').then(m => m.WaterTrackerComponent) },
      { path: 'hormones',  loadComponent: () => import('./features/hormones/hormones.component').then(m => m.HormonesComponent) },
      { path: 'progress',  loadComponent: () => import('./features/progress/progress.component').then(m => m.ProgressComponent) },
      { path: 'profile',   loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent) },
      { path: 'clinical',     loadComponent: () => import('./features/clinical/clinical-dashboard.component').then(m => m.ClinicalDashboardComponent) },
      { path: 'diet',         loadComponent: () => import('./features/diet-plan/diet-plan.component').then(m => m.DietPlanComponent) },
      { path: 'planning',     loadComponent: () => import('./features/planning/planning.component').then(m => m.PlanningComponent) },
      { path: 'medications',  loadComponent: () => import('./features/medications/medications.component').then(m => m.MedicationsComponent) },
      { path: 'protocols',    loadComponent: () => import('./features/protocols/protocols.component').then(m => m.ProtocolsComponent) },
      { path: 'recipes',      loadComponent: () => import('./features/recipes/recipe-community.component').then(m => m.RecipeCommunityComponent) },
      { path: 'glossary',     loadComponent: () => import('./features/glossary/glossary.component').then(m => m.GlossaryComponent) },
      { path: 'check-in',     loadComponent: () => import('./features/check-in/check-in.component').then(m => m.CheckInComponent) },
    ],
  },

  { path: '**', redirectTo: '/dashboard' },
];
